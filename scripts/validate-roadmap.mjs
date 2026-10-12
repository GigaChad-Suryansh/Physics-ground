import fs from "node:fs";

const roadmap = JSON.parse(fs.readFileSync("roadmap/physics-concepts.json", "utf8"));
const progress = JSON.parse(fs.readFileSync("roadmap/progress.json", "utf8"));
const concepts = roadmap.concepts;

if (!Array.isArray(concepts) || concepts.length !== 100) {
  throw new Error(`Roadmap must contain exactly 100 concepts; found ${concepts?.length}`);
}
if (concepts.some((c, i) => c.id !== i + 1)) {
  throw new Error("Concept IDs must be unique and sequential from 1 through 100.");
}
if (new Set(concepts.map(c => c.slug)).size !== 100) {
  throw new Error("Concept slugs must be unique.");
}
for (const c of concepts) {
  if (!c.title || !c.category || !c.slug) throw new Error(`Concept ${c.id} lacks required metadata.`);
  if (!["pending", "in_progress", "completed", "blocked"].includes(c.status)) {
    throw new Error(`Concept ${c.id} has invalid status ${c.status}`);
  }
}
if (progress.roadmap_version !== roadmap.roadmap_version) {
  throw new Error("Progress and roadmap versions do not match.");
}
if (!Array.isArray(progress.completed_ids) || new Set(progress.completed_ids).size !== progress.completed_ids.length) {
  throw new Error("completed_ids must be an array of unique IDs.");
}
for (const id of progress.completed_ids) {
  if (!Number.isInteger(id) || id < 1 || id > 100) throw new Error(`Invalid completed ID: ${id}`);
}
const markedCompleted = concepts.filter(c => c.status === "completed").map(c => c.id).sort((a,b)=>a-b);
const progressCompleted = [...progress.completed_ids].sort((a,b)=>a-b);
if (JSON.stringify(markedCompleted) !== JSON.stringify(progressCompleted)) {
  throw new Error("Completed concept statuses must match progress.completed_ids.");
}
console.log("Roadmap validation passed: 100 concepts, unique IDs/slugs, and consistent progress.");
