// Validate every exam pack against schema/ plus the invariants the engine relies on.
// Dependency-free on purpose: the project has no build step and no node_modules.
//
//   npm run validate

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMS = join(root, "public", "content", "exams");
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

/* ---- a small JSON Schema subset: type, required, properties, items, enum ---- */
function check(value, schema, path, where) {
  if (!schema || typeof schema !== "object") return;
  if (schema.enum && !schema.enum.includes(value)) {
    fail(where, `${path} must be one of ${schema.enum.join(", ")} (got ${JSON.stringify(value)})`);
    return;
  }
  if (schema.type) {
    const t = schema.type;
    const ok =
      t === "array" ? Array.isArray(value) :
      t === "object" ? value && typeof value === "object" && !Array.isArray(value) :
      t === "number" ? typeof value === "number" :
      t === "string" ? typeof value === "string" : true;
    if (!ok) { fail(where, `${path} must be a ${t} (got ${Array.isArray(value) ? "array" : typeof value})`); return; }
  }
  if (Array.isArray(schema.required)) {
    for (const k of schema.required) {
      if (value == null || !(k in value)) fail(where, `${path}.${k} is required`);
    }
  }
  if (schema.properties && value && typeof value === "object") {
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (k in value) check(value[k], sub, `${path}.${k}`, where);
    }
  }
  if (schema.items && Array.isArray(value)) {
    value.forEach((v, i) => check(v, schema.items, `${path}[${i}]`, where));
  }
}

/* ---- engine invariants that a schema cannot express ---- */
function invariants(exam, where) {
  const { scale, sections } = exam;

  if (scale.min >= scale.max) fail(where, "scale.min must be below scale.max");
  if (scale.kind === "half-step" && scale.step !== 0.5) fail(where, "a half-step scale must declare step 0.5");
  if (scale.kind === "integer" && scale.step && scale.step !== 1) fail(where, "an integer scale must declare step 1");
  if (!String(scale.format).includes("{v}")) fail(where, "scale.format must contain the {v} placeholder");

  // raw -> score tables must descend by minRaw and stay inside the scale
  for (const s of sections) {
    if (!s.raw) continue;
    const t = s.raw.table;
    let prev = Infinity;
    t.forEach((row, i) => {
      if (!Array.isArray(row) || row.length !== 2) { fail(where, `${s.skill}.raw.table[${i}] must be [minRaw, score]`); return; }
      const [minRaw, score] = row;
      if (minRaw > prev) fail(where, `${s.skill}.raw.table must be ordered by descending minRaw (row ${i})`);
      prev = minRaw;
      if (minRaw < 0 || minRaw > s.raw.outOf) fail(where, `${s.skill}.raw.table[${i}] minRaw ${minRaw} is outside 0..${s.raw.outOf}`);
      if (score < scale.min || score > scale.max) fail(where, `${s.skill}.raw.table[${i}] score ${score} is outside the scale`);
    });
    if (t.length && t[t.length - 1][0] !== 0) fail(where, `${s.skill}.raw.table must end with a row at minRaw 0 so every answer gets a score`);
  }

  // weighted aggregation needs weights to weight
  for (const s of sections) {
    if (s.aggregate === "weighted-mean-round-half-band") {
      if (!Array.isArray(s.tasks) || !s.tasks.length) fail(where, `${s.skill} uses weighted aggregation but declares no tasks`);
      else for (const task of s.tasks) if (typeof task.weight !== "number") fail(where, `${s.skill} task ${task.id} needs a numeric weight`);
    }
  }

  // levels must sit inside the exam's own scale and ascend
  const order = ["beginner", "intermediate", "advanced", "professional"];
  let ceiling = -Infinity;
  for (const name of order) {
    const r = exam.levelMap[name];
    if (!Array.isArray(r) || r.length !== 2) { fail(where, `levelMap.${name} must be [low, high]`); continue; }
    const [lo, hi] = r;
    if (lo > hi) fail(where, `levelMap.${name} is inverted`);
    if (lo < scale.min || hi > scale.max) fail(where, `levelMap.${name} falls outside the scale`);
    if (lo < ceiling) fail(where, `levelMap.${name} overlaps the level below it`);
    ceiling = hi;
  }

  // a pack that shares items must point at an exam that exists
  for (const s of sections) {
    if (s.sharesItemsWith && !existsSync(join(EXAMS, s.sharesItemsWith, "exam.json"))) {
      fail(where, `${s.skill}.sharesItemsWith points at unknown exam "${s.sharesItemsWith}"`);
    }
  }

  // honesty: a pack claiming an official overall must not be an exam that has none
  if (scale.overall.method === "trait-estimate") {
    fail(where, "scale.overall.method must not be trait-estimate; an estimate is a UI affordance, not the exam's overall");
  }
}

/* ---- items, when a pack has them ---- */
function checkItems(dir, where) {
  const itemsDir = join(dir, "items");
  if (!existsSync(itemsDir)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith(".json")) continue;
      n++;
      let item;
      try { item = JSON.parse(readFileSync(p, "utf8")); }
      catch (e) { fail(`${where}/${entry.name}`, `invalid JSON: ${e.message}`); continue; }
      if (item.provenance !== "original") {
        fail(`${where}/${entry.name}`, 'every item must declare "provenance": "original" — no copied past papers');
      }
      if (!item.id) fail(`${where}/${entry.name}`, "item needs an id");
    }
  };
  walk(itemsDir);
  return n;
}

/* ---- run ---- */
const examSchema = JSON.parse(readFileSync(join(root, "schema", "exam.schema.json"), "utf8"));
if (!existsSync(EXAMS)) { console.error(`No exam packs found at ${EXAMS}`); process.exit(1); }

const packs = readdirSync(EXAMS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort();

let items = 0;
for (const name of packs) {
  const dir = join(EXAMS, name);
  const file = join(dir, "exam.json");
  if (!existsSync(file)) { fail(name, "missing exam.json"); continue; }
  let exam;
  try { exam = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { fail(name, `invalid JSON: ${e.message}`); continue; }

  if (exam.id !== name) fail(name, `exam.id "${exam.id}" does not match its folder name`);
  check(exam, examSchema, "exam", name);
  if (exam.scale && exam.sections && exam.levelMap) invariants(exam, name);
  items += checkItems(dir, name);
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s) in ${packs.length} pack(s):\n`);
  for (const e of errors) console.error("  - " + e);
  console.error("");
  process.exit(1);
}
console.log(`✓ ${packs.length} exam pack(s) valid (${packs.join(", ")}); ${items} item file(s) checked`);
