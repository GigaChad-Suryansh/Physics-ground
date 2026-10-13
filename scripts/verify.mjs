#!/usr/bin/env node
/**
 * Independent verification of whatever the agent left in the working tree.
 * The agent's own report is never trusted: this runs the real build and tests.
 *
 *   node scripts/verify.mjs
 *
 * Writes to $GITHUB_OUTPUT:
 *   ok        "true" | "false"   (build + tests + roadmap validation all pass)
 *   changed   "true" | "false"   (agent left source/roadmap changes)
 *   errors    multi-line, trimmed compiler/test output (only when ok=false)
 * Always exits 0 so later steps can decide what to do.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  console.log(`\n=== ${label}: exit ${r.status} ===`);
  console.log(out.split('\n').slice(-40).join('\n'));
  return { label, status: r.status ?? 1, out };
}

/** Keep the lines that explain a failure, not the whole log. */
function digest(res) {
  const lines = res.out.split('\n');
  const keep = lines.filter((l) =>
    /error TS\d+|FAIL|AssertionError|Error:|expected|received|Cannot find|is not assignable|does not exist|✗|×/.test(l)
  );
  const body = (keep.length ? keep : lines.slice(-30)).slice(0, 40).join('\n');
  return `### ${res.label} failed\n${body}`;
}

const results = [
  run('roadmap validation', 'node', ['scripts/validate-roadmap.mjs']),
  run('build (tsc + vite)', 'npm', ['run', 'build']),
  run('tests', 'npm', ['test']),
];
const failed = results.filter((r) => r.status !== 0);

const changed =
  (spawnSync('git', ['status', '--porcelain', '--', 'src', 'roadmap/physics-concepts.json', 'roadmap/progress.json'], {
    encoding: 'utf8',
  }).stdout || '').trim().length > 0;

// A concept may only be marked complete if it was actually integrated.
function completionClaimProblem() {
  try {
    const before = JSON.parse(spawnSync('git', ['show', 'HEAD:roadmap/progress.json'], { encoding: 'utf8' }).stdout || '{}');
    const after = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
    const added = (after.completed_ids || []).filter((id) => !(before.completed_ids || []).includes(id));
    if (added.length === 0) return null;
    const touched = (spawnSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).stdout || '').split('\n');
    const hasPage = touched.some((l) => /src\/simulations\//.test(l));
    const hasPhysics = touched.some((l) => /src\/physics\//.test(l));
    const hasRoute = touched.some((l) => /src\/App\.tsx/.test(l));
    if (!(hasPage && hasPhysics && hasRoute)) {
      return `### completion claim rejected\nconcept(s) ${added.join(', ')} were marked completed but the working tree has no new simulation page + physics module + route (page: ${hasPage}, physics: ${hasPhysics}, route: ${hasRoute}).`;
    }
  } catch {
    /* unreadable progress is caught by roadmap validation */
  }
  return null;
}
const claimProblem = completionClaimProblem();
const ok = failed.length === 0 && !claimProblem;
const errors = [...failed.map(digest), ...(claimProblem ? [claimProblem] : [])].join('\n\n').slice(0, 6000);

console.log(`\nVERIFY: ok=${ok} changed=${changed}`);
if (process.env.GITHUB_OUTPUT) {
  const delim = `ERR_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `ok=${ok}\nchanged=${changed}\nerrors<<${delim}\n${errors}\n${delim}\n`
  );
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Verification (${process.env.VERIFY_LABEL || 'check'})\n\n${ok ? '✅ build, tests and roadmap validation pass' : '❌ failed\n\n```\n' + errors + '\n```'}\n`
  );
}
