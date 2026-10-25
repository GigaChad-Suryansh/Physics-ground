#!/usr/bin/env node
/**
 * Builds the task brief that is handed to the Gemini agent.
 *
 * Why: an agent with a small turn/quota budget wastes most of it exploring
 * (listing folders, reading JSON, working out which concept is next). That is
 * deterministic work, so it is done here and given to the agent up front.
 *
 * Output: the brief is written to $GITHUB_OUTPUT as `prompt` (multi-line) and
 * printed to the log. Pass TEST_EXIT / BUILD_EXIT (baseline exit codes) via env.
 */
import fs from 'node:fs';
import path from 'node:path';
import { slugOf, pathsOf, phaseOf } from './concept-paths.mjs';

const roadmap = JSON.parse(fs.readFileSync('roadmap/physics-concepts.json', 'utf8'));
const progress = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
const concepts = roadmap.concepts;
const completed = new Set(progress.completed_ids || []);
const blocked = new Set((progress.blocked_concepts || []).map((b) => (typeof b === 'object' ? b.id : b)));

const testExit = process.env.TEST_EXIT ?? 'unknown';
const buildExit = process.env.BUILD_EXIT ?? 'unknown';
const baselineHealthy = testExit === '0' && buildExit === '0';

/** Lowest-numbered unfinished concept whose dependencies are done; resume in-progress work first. */
function eligible(c) {
  if (c.status === 'completed' || blocked.has(c.id)) return false;
  return (c.dependencies || []).every((d) => completed.has(d));
}
const inProgress = concepts.find((c) => c.status === 'in_progress' && eligible(c));
const next = inProgress || concepts.find((c) => eligible(c));

function list(dir, filter = () => true) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory() ? list(path.join(dir, e.name), filter) : filter(e.name) ? [path.join(dir, e.name)] : []
      );
  } catch {
    return [];
  }
}

const simulations = list('src/simulations', (n) => n.endsWith('.tsx'));
const physics = list('src/physics', (n) => n.endsWith('.ts'));
const tests = list('src/tests', (n) => n.endsWith('.ts'));

/**
 * Real prop/type signatures of the shared building blocks, extracted from the
 * source so the brief can never drift from the code. (The agent previously
 * guessed prop names like `isPlaying` / `onStepForward` and broke the build.)
 */
function extractApi(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(export\s+)?(interface|type)\s+\w+/.test(l)) {
      const block = [l];
      if (!/;\s*$/.test(l) || /\{\s*$/.test(l)) {
        while (i + 1 < lines.length && !/^[}\]]/.test(lines[i + 1]) && block.length < 60) block.push(lines[++i]);
        if (i + 1 < lines.length) block.push(lines[++i]);
      }
      out.push(block.filter((x) => x.trim() !== '').join('\n'));
    } else if (/^export\s+const\s+\w+(\s*:[^=]+)?\s*=\s*\{\s*$/.test(l)) {
      // Object literal constant (e.g. CANVAS_COLORS): list its keys so the agent cannot invent new ones.
      const name = l.match(/^export\s+const\s+(\w+)/)[1];
      const keys = [];
      let j = i + 1;
      while (j < lines.length && !/^\}/.test(lines[j])) {
        const m = lines[j].match(/^ {2}['"]?([\w-]+)['"]?\s*:/);
        if (m) keys.push(m[1]);
        j++;
      }
      out.push(`export const ${name}: object with EXACTLY these keys: ${keys.join(', ')}`);
      i = j;
    } else if (/^export\s+(async\s+)?function\s+\w+/.test(l) || /^export\s+const\s+\w+\s*[:=]/.test(l)) {
      // Signature only: join lines until <> () {} are balanced, then cut at " = " / body.
      let sig = l;
      let j = i;
      const depth = (t) => {
        const u = t.replace(/=>/g, '->');
        const c = (re) => (u.match(re) || []).length;
        return c(/</g) - c(/>/g) + c(/\(/g) - c(/\)/g) + c(/\{/g) - c(/\}/g);
      };
      while (depth(sig) > 0 && j + 1 < lines.length && j - i < 8) sig += ' ' + lines[++j].trim();
      sig = sig.replace(/\s+/g, ' ');
      if (/^export\s+const/.test(sig)) sig = sig.replace(/\s=\s.*$/, '');
      else sig = sig.replace(/\)\s*(:\s*[^{]+)?\{.*$/, (m, ret) => ')' + (ret ? ret.trimEnd() : ''));
      out.push(sig.trim());
    }
  }
  return out.join('\n');
}

const API_FILES = [
  'src/components/layout/LabLayout.tsx',
  'src/components/controls/SimulationControls.tsx',
  'src/components/ui/Panel.tsx',
  'src/components/ui/Slider.tsx',
  'src/components/ui/theme.ts',
  'src/components/charts/PhysicsChart.tsx',
  'src/components/canvas/SimCanvas.tsx',
  'src/components/canvas/draw.ts',
  'src/hooks/useSimulation.ts',
  'src/hooks/useTelemetry.ts',
];
const apiSheet = API_FILES.map((f) => `// ${f}\n${extractApi(f)}`).join('\n\n');

const lastFailure = progress.last_failure;
const failureNote =
  lastFailure && (!next || lastFailure.concept_id === next.id)
    ? `\n## A previous attempt at this task FAILED verification\nThe workflow discarded it. The errors were:\n\n${lastFailure.note}\n\nAvoid the same mistake: use ONLY the exact prop names in the API reference below.\n`
    : '';

const knownBugs = (progress.known_bugs || []).map((b) => `- ${typeof b === 'string' ? b : JSON.stringify(b)}`);

let phase = 0; // 0 = not a concept task (baseline fix / all done)
const parts = [];
parts.push(`# Today's brief (generated by scripts/agent-brief.mjs — trust it, do not re-derive it)

## Budget
You have a SMALL tool-call budget (about 30 calls) and a free-tier API quota. Do not explore. Read only the files named here, batch several shell commands into one call, and write complete files in one write_file call rather than many small edits. Stop as soon as the task below is done and validated.

## Baseline (already measured by the workflow)
- Tests exit code: ${testExit} (0 = pass)
- Build exit code: ${buildExit} (0 = pass)
- Roadmap progress: ${completed.size}/100 concepts completed; last completed ID ${progress.last_completed_id ?? 0}.
${knownBugs.length ? '- Known bugs recorded earlier:\n' + knownBugs.join('\n') : '- No known bugs recorded in progress.json.'}
`);

if (!baselineHealthy) {
  parts.push(`## Task: FIX THE FAILING BASELINE (no new concept today)
Run \`npm test 2>&1 | tail -60\` and/or \`npm run build 2>&1 | tail -60\`, find the root cause, and fix it. Never delete, skip, or weaken a test. Record the fix in roadmap/progress.json.
`);
} else if (!next) {
  parts.push(`## Task: all 100 concepts are complete
Only look for bugs, correctness, accessibility, performance, tests, and docs. Make at most one small, safe improvement.
`);
} else {
  const slug = slugOf(next);
  const P = pathsOf(slug);
  phase = phaseOf(slug);
  const F = '```';
  const rd = (f) => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      return '(missing)';
    }
  };
  /** The block of an array/JSX list that mentions `needle`, so the agent sees the exact registration style. */
  const around = (file, needle, before, after) => {
    const ls = rd(file).split('\n');
    const i = ls.findIndex((l) => l.includes(needle));
    return i < 0 ? '(not found)' : ls.slice(Math.max(0, i - before), i + after + 1).join('\n');
  };
  const concept = { id: next.id, title: next.title, category: next.category, difficulty: next.difficulty, slug };
  parts.push(`## Task: concept ${next.id} "${next.title}" — STEP ${phase} of 3
The work is split into small steps on purpose: the free Gemini API allows only ~20 requests per model per day. Do ONLY this step, about 10 tool calls in total. Everything you need is pasted below, so do NOT explore, list directories or read other files. Write whole files in one write_file call.

${F}json
${JSON.stringify(concept)}
${F}
`);

  if (phase === 1) {
    parts.push(`## STEP 1 — physics model + tests (no page, no routes)
1. Write ${P.physics}: a pure TypeScript module (no React) with exported parameter/state types, a DEFAULT_ params constant, analytical-solution functions and a step function where relevant. Document the equations and assumptions in a header comment. Keep it under ~120 lines.
2. Write ${P.test}: a NEW vitest file (do not edit src/tests/physics.test.ts) with 4-6 tests that compare the module against hand-computed analytical values (import { describe, it, expect } from 'vitest'; import from '../physics/mechanics/${slug}'; use toBeCloseTo).
3. Do NOT create pages, do NOT edit src/App.tsx or Sidebar.tsx, do NOT edit anything under roadmap/ (the workflow records progress itself).

Pattern to follow (an existing, working physics module):
${F}ts
${rd('src/physics/mechanics/speed-velocity.ts')}
${F}

Vector helpers available: \`import { add, sub, scale, length, rotate, Vec2 } from '../vector'\` — only use names that exist in src/physics/vector.ts:
${F}ts
${extractApi('src/physics/vector.ts')}
${F}
`);
  } else if (phase === 2) {
    parts.push(`## STEP 2 — simulation page + registration
The physics module for this concept already exists (do not change it):
${F}ts
${rd(P.physics)}
${F}

1. Write ${P.page}, exporting \`export const ${P.component}: React.FC\`. COPY the page below and change ONLY the physics, labels, sliders and formulas. At most ~300 lines, one SimCanvas, one PhysicsChart, 2-4 sliders. Use only props that appear in the API reference further down.
${F}tsx
${rd('src/simulations/speed-velocity/SpeedVelocityPage.tsx')}
${F}
2. Register it. In src/App.tsx add an import and a route with path "/sim/${slug}" — existing style:
${F}tsx
${around('src/App.tsx', 'SpeedVelocityPage', 0, 0)}
${around('src/App.tsx', 'path="/sim/speed-and-velocity"', 0, 0)}
${F}
In src/components/layout/Sidebar.tsx append ONE entry at the END of the SIMULATION_MODULES array (never insert at the top or reorder; id must be "${slug}", path "/sim/${slug}") — existing style:
${F}ts
${around('src/components/layout/Sidebar.tsx', "path: '/sim/speed-and-velocity'", 3, 8)}
${F}
3. Do NOT edit anything under roadmap/ and do not touch the physics module or tests.
`);
  } else {
    parts.push(`## STEP 3 — nothing for you to do
All files for this concept exist; the workflow marks it complete itself. Make no changes.
`);
  }
}

parts.push(`${failureNote}
${phase === 2 || phase === 0 ? `## Shared component API reference (EXACT signatures — the TypeScript check is strict; do not invent props)
${'```'}ts
${apiSheet}
${'```'}
` : ''}
## Before you finish
${phase === 1 ? 'Run: npx tsc --noEmit 2>&1 | head -30 ; npm test 2>&1 | tail -20 — fix every error, repeat until both are clean, then stop.' : phase === 2 ? 'Run: npx tsc --noEmit 2>&1 | head -30 FIRST and fix every error; then npm test 2>&1 | tail -15 ; npm run build 2>&1 | tail -10 — all must pass, then stop.' : 'Make sure npx tsc --noEmit, npm test and npm run build pass, then stop.'}
The workflow re-runs the checks itself and discards work that fails, so unverified work is wasted. Never claim success you have not seen. Do not edit roadmap/, .github/, scripts/ or GEMINI.md, and do not commit or push.
`);

const prompt = parts.join('\n');
console.log(prompt);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `concept_id=${next ? next.id : ''}\nphase=${phase}\n`);
  const delim = `BRIEF_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `prompt<<${delim}\n${prompt}\n${delim}\n`);
}
