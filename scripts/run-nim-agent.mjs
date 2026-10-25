#!/usr/bin/env node
/**
 * Small tool-using coding agent backed by NVIDIA's OpenAI-compatible NIM API.
 * It intentionally exposes only repository reading/editing and an allowlisted
 * set of read-only/test commands. The workflow independently verifies changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const API_KEY = (process.env.NVIDIA_API_KEY || '').trim();
const BASE = (process.env.NVIDIA_API_BASE || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
const MODEL = (process.env.NVIDIA_MODEL || 'openai/gpt-oss-120b').trim();
const TASK = process.env.NIM_AGENT_PROMPT || '';
const MAX_STEPS = Number(process.env.NIM_AGENT_MAX_STEPS || 30);
const MAX_OUTPUT = 12000;
const PROTECTED = ['.github', 'scripts', 'GEMINI.md'];

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file in the repository. Paths are relative to the repository root.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or replace a UTF-8 text file. Only source and roadmap files may be edited; protected automation files cannot be changed.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_in_file',
      description: 'Replace one exact text occurrence in a UTF-8 repository file. Fails unless old_text occurs exactly once.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } },
        required: ['path', 'old_text', 'new_text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_shell_command',
      description: 'Run a safe allowlisted repository inspection, validation, test, or build command. Provide executable and args separately; no shell syntax or pipes.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', enum: ['npm', 'node', 'npx', 'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'git'] },
          args: { type: 'array', items: { type: 'string' }, maxItems: 20 },
        },
        required: ['command', 'args'],
        additionalProperties: false,
      },
    },
  },
];

function writeSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}
function output(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
function safePath(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Path must be a non-empty string.');
  const normalized = path.posix.normalize(input.replaceAll('\\\\', '/')).replace(/^\.\//, '');
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) throw new Error('Path must stay inside the repository.');
  if (normalized.split('/').some((part) => part === '.git' || part === 'node_modules' || part.startsWith('.env'))) throw new Error('This path is not available to the agent.');
  return normalized;
}
function assertEditable(file) {
  if (PROTECTED.some((p) => file === p || file.startsWith(p + '/'))) throw new Error('This path is protected by the workflow and cannot be edited.');
  if (!(file.startsWith('src/') || file.startsWith('roadmap/') || ['README.md', 'index.html'].includes(file))) {
    throw new Error('Only src/, roadmap/, README.md, and index.html may be edited.');
  }
}
function cap(value) {
  const text = String(value ?? '');
  return text.length > MAX_OUTPUT ? text.slice(0, MAX_OUTPUT) + '\n… output truncated …' : text;
}

function runCommand(command, args) {
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) throw new Error('args must be an array of strings.');
  const first = args[0] || '';
  if (command === 'git' && !['status', 'diff'].includes(first)) throw new Error('Only git status and git diff are allowed.');
  if (command === 'npm' && ![['test'], ['run', 'build'], ['run', 'dev'], ['run', 'preview']].some((allowed) => allowed.every((x, i) => args[i] === x))) {
    throw new Error('Only npm test, npm run build, npm run dev, and npm run preview are allowed.');
  }
  if (command === 'npx' && !(args[0] === 'tsc' && args[1] === '--noEmit')) throw new Error('Only npx tsc --noEmit is allowed.');
  if (command === 'node' && !(args[0] === 'scripts/validate-roadmap.mjs' || args[0] === 'scripts/agent-brief.mjs')) throw new Error('Only the repository roadmap validator and brief script are allowed.');
  if (command === 'git' && first === 'status' && args.slice(1).some((a) => !['--short', '--porcelain'].includes(a))) throw new Error('Only git status --short is allowed.');
  if (command === 'git' && first === 'diff' && args.slice(1).some((a) => !['--stat', '--', 'src', 'roadmap/physics-concepts.json', 'roadmap/progress.json'].includes(a))) throw new Error('Only a read-only diff/stat for source and roadmap files is allowed.');
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  return cap(`exit code: ${result.status ?? 1}\n${result.stdout || ''}${result.stderr || ''}`);
}

function executeTool(name, args) {
  if (name === 'read_file') {
    const file = safePath(args.path);
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error('Path is not a file.');
    if (stat.size > 100000) throw new Error('File exceeds the 100 KB read limit; use targeted shell commands instead.');
    return cap(fs.readFileSync(file, 'utf8'));
  }
  if (name === 'write_file') {
    const file = safePath(args.path);
    assertEditable(file);
    if (typeof args.content !== 'string' || args.content.length > 100000) throw new Error('Content must be text no larger than 100 KB.');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, args.content);
    return `Wrote ${file} (${args.content.length} characters).`;
  }
  if (name === 'replace_in_file') {
    const file = safePath(args.path);
    assertEditable(file);
    const oldText = args.old_text;
    if (typeof oldText !== 'string' || !oldText.length) throw new Error('old_text must be non-empty.');
    const current = fs.readFileSync(file, 'utf8');
    const first = current.indexOf(oldText);
    if (first < 0 || current.indexOf(oldText, first + oldText.length) >= 0) throw new Error('old_text must occur exactly once; no changes made.');
    fs.writeFileSync(file, current.slice(0, first) + String(args.new_text ?? '') + current.slice(first + oldText.length));
    return `Updated one exact occurrence in ${file}.`;
  }
  if (name === 'run_shell_command') return runCommand(args.command, args.args);
  throw new Error(`Unknown tool: ${name}`);
}

async function api(messages) {
  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 4096,
      stream: false,
    }),
    signal: AbortSignal.timeout(120000),
  });
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const message = String(body?.error?.message || body?.message || 'No response body').replace(/\s+/g, ' ').slice(0, 700);
    throw new Error(`NVIDIA NIM HTTP ${response.status}: ${message}`);
  }
  const message = body?.choices?.[0]?.message;
  if (!message) throw new Error('NVIDIA NIM returned no assistant message.');
  return message;
}

async function main() {
  if (!API_KEY) throw new Error('NVIDIA_API_KEY is missing.');
  if (!TASK) throw new Error('NIM_AGENT_PROMPT is empty. The workflow must pass the generated task brief.');

  const messages = [
    {
      role: 'system',
      content: [
        'You are the autonomous developer for Physics Ground, an educational interactive physics simulation website.',
        'Follow the user task brief exactly. Prioritize confirmed bugs and failing checks over new features.',
        'Use the provided tools to inspect files, make small changes, and run checks. Never claim a command passed unless its output confirms it.',
        'Do not attempt to commit, push, create branches, modify workflows, scripts, secrets, or your own instructions.',
        'Keep existing tests intact. Do not weaken or delete tests. Do not mark a concept complete unless it is implemented and verified.',
        'When done, provide a concise factual summary. If you cannot finish safely, explain the blocker.',
      ].join('\n'),
    },
    { role: 'user', content: TASK },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const message = await api(messages);
    messages.push(message);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) {
      const finalText = String(message.content || '').trim() || 'The model returned no final summary.';
      console.log(finalText);
      writeSummary(`## NVIDIA NIM agent report\n\nModel: \`${MODEL}\`\n\n${finalText}`);
      output('agent_completed', 'true');
      return;
    }

    for (const call of calls) {
      const name = call.function?.name;
      let result;
      try {
        const args = JSON.parse(call.function?.arguments || '{}');
        result = executeTool(name, args);
      } catch (error) {
        result = `Tool error: ${error.message}`;
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: cap(result) });
    }
  }

  const note = `Reached the maximum of ${MAX_STEPS} model steps; the workflow will independently verify any edits made so far.`;
  console.log(note);
  writeSummary(`## NVIDIA NIM agent report\n\n⚠️ ${note}`);
  output('agent_completed', 'false');
}

main().catch((error) => {
  const message = String(error?.message || error);
  console.error(`::error title=NVIDIA NIM agent failed::${message.split('\n')[0]}`);
  writeSummary(`## NVIDIA NIM agent failed\n\n${message}`);
  process.exitCode = 1;
});
