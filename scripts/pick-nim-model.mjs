#!/usr/bin/env node
/**
 * NVIDIA NIM preflight for Physics Ground's autonomous developer workflow.
 * Tests the configured hosted model before starting the coding agent.
 */
import fs from 'node:fs';

const API_KEY = (process.env.NVIDIA_API_KEY || '').trim();
const BASE = (process.env.NVIDIA_API_BASE || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
const MODEL = (process.env.NVIDIA_MODEL || 'openai/gpt-oss-120b').trim();
const TIMEOUT_MS = Number(process.env.NVIDIA_PICK_TIMEOUT_MS || 20000);

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
function summary(body) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body + '\n');
}
function fail(title, detail) {
  console.error(`::error title=${title}::${detail.split('\n')[0]}`);
  summary(`## NVIDIA NIM preflight failed\n\n**${title}**\n\n${detail}`);
  process.exit(1);
}

async function main() {
  if (!API_KEY) {
    fail('NVIDIA_API_KEY is empty', 'Add the NVIDIA API key under Settings → Secrets and variables → Actions → Secrets, using the exact name NVIDIA_API_KEY.');
  }
  if (!MODEL) fail('NVIDIA_MODEL is empty', 'Set the repository variable NVIDIA_MODEL to a model ID available in the NVIDIA API Catalog.');

  let response;
  try {
    response = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
        max_tokens: 16,
        temperature: 0,
        reasoning_effort: 'low',
        chat_template_kwargs: { clear_thinking: true },
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    fail('Could not reach NVIDIA NIM', `Request failed: ${error.name === 'TimeoutError' ? 'timed out' : error.message}`);
  }

  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const message = String(body?.error?.message || body?.message || 'No error message returned').replace(/\s+/g, ' ').slice(0, 500);
    const hint = response.status === 401 || response.status === 403
      ? ' Check that the NVIDIA API key is valid and has access to this endpoint.'
      : response.status === 404
        ? ' Check NVIDIA_MODEL against the currently available models in the NVIDIA API Catalog.'
        : response.status === 429
          ? ' The model/account rate limit or quota may be exhausted; check the NVIDIA API Catalog usage details.'
          : '';
    fail(`NVIDIA NIM request failed (HTTP ${response.status})`, message + hint);
  }

  const answer = body?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string') fail('NVIDIA NIM returned an unexpected response', 'Expected choices[0].message.content from the chat-completions API.');
  output('model', MODEL);
  summary(`## NVIDIA NIM preflight\n\n✅ Model \`${MODEL}\` responded successfully.\n\nEndpoint: \`${BASE}/chat/completions\`\n\nThe agent will use this model for the run.`);
  console.log(`Selected NVIDIA NIM model: ${MODEL}`);
}

main().catch((error) => fail('NVIDIA NIM preflight crashed', error.message));
