#!/usr/bin/env node
/** Marks a fully integrated concept as completed (no AI involved). Env: CONCEPT_ID. */
import fs from 'node:fs';
import { slugOf, integrated } from './concept-paths.mjs';

const id = Number(process.env.CONCEPT_ID);
const roadmapFile = 'roadmap/physics-concepts.json';
const roadmap = JSON.parse(fs.readFileSync(roadmapFile, 'utf8'));
const progress = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
const concept = roadmap.concepts.find((c) => c.id === id);
if (!concept) throw new Error(`concept ${id} not found`);
if (!integrated(slugOf(concept))) throw new Error(`concept ${id} is not fully integrated; refusing to mark it complete`);

concept.status = 'completed';
progress.completed_ids = [...new Set([...(progress.completed_ids || []), id])].sort((a, b) => a - b);
progress.last_completed_id = Math.max(...progress.completed_ids);
progress.last_run = new Date().toISOString();
progress.last_outcome = 'success';
progress.current_task = `Completed concept ${id}: ${concept.title}`;
progress.consecutive_failures = 0;
progress.last_failure = null;
progress.notes = `Concept ${id} (${concept.title}) is integrated (physics module, page, route) and was marked complete by the workflow.`;
fs.writeFileSync(roadmapFile, JSON.stringify(roadmap, null, 2) + '\n');
fs.writeFileSync('roadmap/progress.json', JSON.stringify(progress, null, 2) + '\n');
console.log(`Marked concept ${id} complete.`);
