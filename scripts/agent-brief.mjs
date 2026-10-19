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
  parts.push(`## Task: bug check, then ONE concept
1. Quick bug audit (max ~5 tool calls): run \`git status --short\` and skim the page/physics file most related to the concept below. Only if you find a reproducible defect, fix that INSTEAD of adding the concept and record it in progress.json \`known_bugs\`.
2. Otherwise implement this concept (${inProgress ? 'it is already in progress — continue it' : 'lowest-numbered eligible'}):

\`\`\`json
${JSON.stringify(next, null, 2)}
\`\`\`

Fill in the empty fields of the concept (learning_objectives, key_equations, visualization_requirements, controls, validation_cases) in roadmap/physics-concepts.json as you design it.
`);
  parts.push(`## How to add a concept (follow the existing architecture)
- Physics model: new pure TypeScript module in \`src/physics/<area>/<slug>.ts\` (see \`src/physics/mechanics/projectile.ts\`). No React inside physics code. Document equations and assumptions in the file header.
- Page: \`src/simulations/<slug>/<Name>Page.tsx\`. COPY THE STRUCTURE of \`src/simulations/projectile/ProjectileMotionPage.tsx\`: LabLayout, SimulationControls, SimCanvas (+ helpers in src/components/canvas/draw.ts), Panel/ReadoutBar/FormulaList (src/components/ui/Panel.tsx), Slider, PhysicsChart, useSimulation, useTelemetry, and a \`paramsRef\` so changing a slider calls reset() with fresh values.
- Register it: add a route in \`src/App.tsx\` and an entry in \`SIMULATION_MODULES\` in \`src/components/layout/Sidebar.tsx\` (the landing page reads that list).
- Tests: add cases to \`src/tests/physics.test.ts\` that compare against analytical results (use the existing describe blocks as a template). Never weaken existing tests.
- KEEP THE PAGE SMALL AND SIMPLE: at most ~300 lines, one canvas, one chart, 2-4 sliders, copy \`src/simulations/speed-velocity/SpeedVelocityPage.tsx\` (the shortest working example) and change only the physics. Long pages are where the typos that break the build come from.
- Do not use <canvas> directly, do not add dependencies, do not redesign existing pages.
`);
}

parts.push(`${failureNote}
## Shared component API reference (EXACT signatures — the TypeScript check is strict; do not invent props)
\`\`\`ts
${apiSheet}
\`\`\`

## Existing files (for reference — do not list directories again)
- Simulation pages: ${simulations.join(', ') || '(none)'}
- Physics modules: ${physics.join(', ') || '(none)'}
- Tests: ${tests.join(', ') || '(none)'}

## Before you finish (3 calls)
1. FIRST \`npx tsc --noEmit 2>&1 | head -40\` and fix every error (repeat until clean), THEN \`node scripts/validate-roadmap.mjs && npm test 2>&1 | tail -25 && npm run build 2>&1 | tail -15\`. The workflow re-runs these itself and discards work that does not pass, so unverified work is wasted.
2. Only AFTER step 1 is green, update \`roadmap/progress.json\` (never before; never claim success you have not seen): last_run (ISO date), last_outcome, current_task, bugs found/fixed, concept ID/title worked on, test/build results, blockers, next action. Add the concept ID to completed_ids AND set its status to "completed" in roadmap/physics-concepts.json ONLY if it is integrated, tested, and the build passes. Otherwise set status "in_progress" and describe what remains.
3. Do not touch .github/, scripts/, or GEMINI.md (the workflow reverts changes there). Do not commit or push.
`);

const prompt = parts.join('\n');
console.log(prompt);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `concept_id=${next ? next.id : ''}\n`);
  const delim = `BRIEF_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `prompt<<${delim}\n${prompt}\n${delim}\n`);
}
