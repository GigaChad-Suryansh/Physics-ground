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
  // The workflow's own scripts must at least parse and the brief must build (a syntax error here silently stops every daily run).
  run('workflow scripts', 'node', ['-e', "const {spawnSync:s}=require('node:child_process');const fs=require('node:fs');let bad=0;for(const f of fs.readdirSync('scripts').filter(f=>f.endsWith('.mjs'))){const r=s('node',['--check','scripts/'+f]);if(r.status){bad=1;console.error('syntax error in scripts/'+f+': '+r.stderr)}}const b=s('node',['scripts/agent-brief.mjs'],{env:{...process.env,GITHUB_OUTPUT:'',TEST_EXIT:'0',BUILD_EXIT:'0'}});if(b.status){bad=1;console.error('agent-brief.mjs failed: '+b.stderr)}process.exit(bad)"]),
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
// Existing modules must keep their order; new ones go at the end of SIMULATION_MODULES.
function moduleOrderProblem() {
  const ids = (text) => [...(text.match(/^\s{4}id: '([^']+)'/gm) || [])].map((l) => l.match(/'([^']+)'/)[1]);
  try {
    const before = ids(spawnSync('git', ['show', 'HEAD:src/components/layout/Sidebar.tsx'], { encoding: 'utf8' }).stdout || '');
    const after = ids(fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8'));
    const ok = before.every((id, i) => after[i] === id);
    if (!ok) return `### module order rejected\nExisting entries of SIMULATION_MODULES must keep their order; append new modules at the END. Before: ${before.join(', ')}. After: ${after.join(', ')}.`;
  } catch {
    /* ignore */
  }
  return null;
}
const orderProblem = moduleOrderProblem();
const claimProblem = completionClaimProblem() || orderProblem;
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
