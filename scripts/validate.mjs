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

/* ---- items, forms, tips and rubrics ---- */

// Kept in step with public/engine/itemtypes/index.js by a test.
const KNOWN_TYPES = new Set(["gap-fill", "tfng", "mcq-single"]);

function readJson(p, where) {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { fail(where, `invalid JSON: ${e.message}`); return null; }
}

function eachJson(dir, cb) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) eachJson(p, cb);
    else if (entry.name.endsWith(".json")) cb(p, entry.name);
  }
}

function checkQuestion(q, where, seen) {
  if (!q.id) { fail(where, "a question has no id"); return; }
  if (seen.has(q.id)) fail(where, `duplicate question id "${q.id}"`);
  seen.add(q.id);
  if (!KNOWN_TYPES.has(q.type)) {
    fail(where, `question "${q.id}" uses unregistered item type "${q.type}"`);
    return;
  }
  if (q.answer === undefined || q.answer === null || (Array.isArray(q.answer) && !q.answer.length)) {
    fail(where, `question "${q.id}" has no answer`);
  }
  if (q.type === "mcq-single") {
    if (!Array.isArray(q.options) || q.options.length < 2) fail(where, `question "${q.id}" needs at least two options`);
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
      fail(where, `question "${q.id}" answer must be a 0-based index into its options`);
    }
  }
  if (q.type === "tfng" && !["T", "F", "NG"].includes(q.answer)) {
    fail(where, `question "${q.id}" answer must be T, F or NG`);
  }
  if (q.type === "gap-fill" && !Array.isArray(q.answer)) {
    fail(where, `question "${q.id}" answer must be an array of accepted spellings`);
  }
  if (!q.explain) fail(where, `question "${q.id}" has no explanation — students need to know why`);
}

/** Returns the set of item ids the pack defines. */
function checkContent(dir, name) {
  const itemIds = new Set();
  let count = 0;

  eachJson(join(dir, "items"), (p, file) => {
    count++;
    const where = `${name}/items/${file}`;
    const item = readJson(p, where);
    if (!item) return;
    if (!item.id) { fail(where, "item needs an id"); return; }
    if (itemIds.has(item.id)) fail(where, `duplicate item id "${item.id}"`);
    itemIds.add(item.id);
    if (item.provenance !== "original") {
      fail(where, 'every item must declare "provenance": "original" — no copied past papers');
    }
    // Objective skills carry markable question objects; speaking carries prompts.
    if (item.skill === "listening" || item.skill === "reading") {
      const seen = new Set();
      const qs = Array.isArray(item.questions) ? item.questions
        : Array.isArray(item.parts) ? item.parts.flatMap((x) => x.questions || []) : [];
      qs.forEach((q) => checkQuestion(q, where, seen));
      if (!qs.length) fail(where, `a ${item.skill} set must contain questions`);
    } else if (item.skill === "writing") {
      if (!item.prompt) fail(where, "a writing item needs a prompt");
      if (!item.task) fail(where, "a writing item must say which task it is");
    } else if (item.skill === "speaking") {
      if (!Array.isArray(item.parts) || !item.parts.length) { fail(where, "a speaking set needs parts"); return; }
      for (const part of item.parts) {
        const prompts = part.questions || (part.cue ? [part.cue.topic] : []);
        if (!prompts.length) fail(where, `speaking part ${part.n} has nothing to say`);
        if (prompts.some((t) => typeof t !== "string" || !t.trim())) {
          fail(where, `speaking part ${part.n} has an empty prompt`);
        }
        if (part.kind === "long-turn" && !Array.isArray(part.cue?.points)) {
          fail(where, `speaking part ${part.n} is a long turn but has no cue-card points`);
        }
      }
    } else {
      fail(where, `unknown skill "${item.skill}"`);
    }
  });

  eachJson(join(dir, "forms"), (p, file) => {
    const where = `${name}/forms/${file}`;
    const form = readJson(p, where);
    if (!form) return;
    if (form.provenance !== "original") fail(where, 'a form must declare "provenance": "original"');
    if (!Array.isArray(form.sections) || !form.sections.length) { fail(where, "a form needs sections"); return; }
    for (const sec of form.sections) {
      const refs = sec.set ? [sec.set] : Array.isArray(sec.tasks) ? sec.tasks : [];
      if (!refs.length) fail(where, `form section "${sec.skill}" references no items`);
      for (const ref of refs) {
        const refExam = String(ref).split("/")[0];
        const path = join(EXAMS, refExam, "items", String(ref).split("/").slice(1).join("/") + ".json");
        if (!existsSync(path)) fail(where, `references missing item "${ref}"`);
      }
    }
  });

  eachJson(join(dir, "rubrics"), (p, file) => {
    const where = `${name}/rubrics/${file}`;
    const r = readJson(p, where);
    if (!r) return;
    if (!Array.isArray(r.criteria) || !r.criteria.length) fail(where, "a rubric needs criteria");
    else for (const c of r.criteria) {
      if (!c.key || !c.name) fail(where, "every criterion needs a key and a name");
      if (!Array.isArray(c.factors) || !c.factors.length) fail(where, `criterion "${c.key}" needs factors`);
    }
    for (const c of r.cannotAssess || []) {
      if (!c.why) fail(where, `cannotAssess "${c.key}" must explain why, so the student is told`);
    }
  });

  eachJson(join(dir, "tips"), (p, file) => {
    const where = `${name}/tips/${file}`;
    const t = readJson(p, where);
    if (!t) return;
    if (!t.skill) fail(where, "a tips file needs a skill");
    if (!Array.isArray(t.general)) fail(where, "a tips file needs a general array");
  });

  return { itemIds, count };
}

/** Every rubric an exam.json names must exist. */
function checkRubricRefs(exam, dir, name) {
  const need = new Set();
  for (const s of exam.sections) {
    if (s.rubric) need.add(s.rubric);
    for (const t of s.tasks || []) if (t.rubric) need.add(t.rubric);
  }
  for (const r of need) {
    if (!existsSync(join(dir, "rubrics", r + ".json"))) fail(name, `exam.json names rubric "${r}" but rubrics/${r}.json is missing`);
  }
}

/* ---- run ---- */
const examSchema = JSON.parse(readFileSync(join(root, "schema", "exam.schema.json"), "utf8"));
if (!existsSync(EXAMS)) { console.error(`No exam packs found at ${EXAMS}`); process.exit(1); }

const packs = readdirSync(EXAMS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort();

// content/index.json is what the browser reads instead of listing a directory,
// so it must match what is actually on disk.
const indexPath = join(root, "public", "content", "index.json");
if (!existsSync(indexPath)) fail("content/index.json", "missing; the browser needs it to discover exams");
else {
  const idx = readJson(indexPath, "content/index.json");
  if (idx) {
    const listed = [...(idx.exams || [])].sort();
    for (const p of packs) if (!listed.includes(p)) fail("content/index.json", `pack "${p}" exists on disk but is not listed`);
    for (const l of listed) if (!packs.includes(l)) fail("content/index.json", `lists "${l}" but no such pack exists`);
  }
}

let items = 0;
const ready = [], draft = [];
for (const name of packs) {
  const dir = join(EXAMS, name);
  const file = join(dir, "exam.json");
  if (!existsSync(file)) { fail(name, "missing exam.json"); continue; }
  const exam = readJson(file, name);
  if (!exam) continue;

  if (exam.id !== name) fail(name, `exam.id "${exam.id}" does not match its folder name`);
  check(exam, examSchema, "exam", name);
  if (exam.scale && exam.sections && exam.levelMap) {
    invariants(exam, name);
    checkRubricRefs(exam, dir, name);
  }

  const { itemIds, count } = checkContent(dir, name);
  items += count;

  (exam.status === "ready" ? ready : draft).push(name);
  if (exam.status === "ready") {
    for (const s of exam.sections || []) {
      const source = s.sharesItemsWith || name;
      const hasAny = source === name
        ? [...itemIds].some((id) => id.split("/")[1] === s.skill)
        : existsSync(join(EXAMS, source, "items", s.skill));
      if (!hasAny) fail(name, `status is "ready" but there are no ${s.skill} items`);
    }
  }
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s) in ${packs.length} pack(s):\n`);
  for (const e of errors) console.error("  - " + e);
  console.error("");
  process.exit(1);
}
console.log(`✓ ${packs.length} pack(s) valid — ready: ${ready.join(", ") || "none"}; draft: ${draft.join(", ") || "none"}`);
console.log(`  ${items} item file(s) checked`);
