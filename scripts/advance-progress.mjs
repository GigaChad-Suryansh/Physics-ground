#!/usr/bin/env node
/** Records a verified phase in progress.json (the agent never edits roadmap files). Env: CONCEPT_ID, PHASE. */
import fs from 'node:fs';

const progress = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
const id = Number(process.env.CONCEPT_ID);
const phase = Number(process.env.PHASE);
const label = { 1: 'physics module + tests', 2: 'simulation page + registration' }[phase] || `phase ${phase}`;
progress.last_run = new Date().toISOString();
progress.last_outcome = 'success';
progress.current_task = `Concept ${id}: ${label} done and verified`;
progress.consecutive_failures = 0;
progress.last_failure = null;
progress.notes = `Concept ${id}: ${label} was built and verified. The next run continues from the files on disk.`;
fs.writeFileSync('roadmap/progress.json', JSON.stringify(progress, null, 2) + '\n');
console.log(`Recorded phase ${phase} of concept ${id}.`);
