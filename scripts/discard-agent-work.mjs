#!/usr/bin/env node
/**
 * Called when the agent's work failed independent verification (even after a
 * repair attempt). Keeps the repository buildable:
 *   - throws away the agent's source / roadmap changes,
 *   - records the failure truthfully in roadmap/progress.json,
 *   - after 3 failures on the same concept, marks it blocked so the next run
 *     moves on instead of retrying forever.
 *
 * Env: CONCEPT_ID (concept the brief assigned), FAIL_NOTE (first lines of errors).
 * Writes `discarded_files` to $GITHUB_OUTPUT.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const sh = (args) => spawnSync('git', args, { encoding: 'utf8' });

const changed = sh(['status', '--porcelain', '--', 'src', 'roadmap/physics-concepts.json', 'roadmap/progress.json'])
  .stdout.split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).trim());

// Restore tracked files, remove new untracked ones — but never the run log.
sh(['restore', '--source=HEAD', '--staged', '--worktree', '--', 'src', 'roadmap/physics-concepts.json', 'roadmap/progress.json']);
sh(['clean', '-fdq', '--', 'src']);

const progress = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
const conceptId = Number(process.env.CONCEPT_ID) || null;
const note = (process.env.FAIL_NOTE || 'verification failed').replace(/\s+/g, ' ').trim().slice(0, 500);

progress.last_run = new Date().toISOString();
progress.last_outcome = 'failed_verification';
progress.current_task = conceptId ? `Retry concept ${conceptId}` : progress.current_task;
progress.consecutive_failures = (progress.consecutive_failures || 0) + 1;
progress.last_failure = { concept_id: conceptId, note, at: progress.last_run };
progress.notes =
  'Last run: the agent\'s changes did not pass build/tests and were discarded by the workflow. Nothing was marked complete.';

if (conceptId && progress.consecutive_failures >= 3) {
  progress.blocked_concepts = [
    ...(progress.blocked_concepts || []),
    { id: conceptId, reason: `3 consecutive failed attempts. Last error: ${note}` },
  ];
  progress.consecutive_failures = 0;
}

fs.writeFileSync('roadmap/progress.json', JSON.stringify(progress, null, 2) + '\n');
console.log(`Discarded agent changes: ${changed.join(', ') || '(none)'}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `discarded_files=${changed.join(', ')}\n`);
}
