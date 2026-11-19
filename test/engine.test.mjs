// Item types, objective marking and the pack registry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRegistry, pathOf } from "../public/engine/registry.js";
import { markOne, markAll, questionsOf } from "../public/engine/marker.js";
import * as itemtypes from "../public/engine/itemtypes/index.js";
import { norm } from "../public/engine/dom.js";

/* ---- a registry that reads the real content from disk ---- */
const reg = createRegistry({
  load: async (path) => JSON.parse(readFileSync(new URL("../public/content/" + path, import.meta.url), "utf8")),
});

test("content ids map to the right paths", () => {
  assert.equal(pathOf("ielts-academic", "exam"), "exams/ielts-academic/exam.json");
  assert.equal(pathOf("ielts-academic/listening/set-01", "item"), "exams/ielts-academic/items/listening/set-01.json");
  assert.equal(pathOf("ielts-academic/forms/test-01", "form"), "exams/ielts-academic/forms/test-01.json");
  assert.equal(pathOf("ielts-academic/speaking", "rubric"), "exams/ielts-academic/rubrics/speaking.json");
  assert.equal(pathOf("ielts-academic/reading", "tips"), "exams/ielts-academic/tips/reading.json");
});

test("the registry lists exams in display order and caches them", async () => {
  const exams = await reg.exams();
  assert.deepEqual(exams.map((e) => e.id), ["ielts-academic", "ielts-general"]);
  const a = await reg.exam("ielts-academic");
  const b = await reg.exam("ielts-academic");
  assert.equal(a, b, "a second read should come from cache, not re-parse");
});

test("General Training borrows Listening and Speaking items from Academic", async () => {
  assert.equal(await reg.itemSourceOf("ielts-general", "listening"), "ielts-academic");
  assert.equal(await reg.itemSourceOf("ielts-general", "speaking"), "ielts-academic");
  assert.equal(await reg.itemSourceOf("ielts-general", "reading"), "ielts-general");
  assert.equal(await reg.itemSourceOf("ielts-academic", "listening"), "ielts-academic");
});

test("a form resolves into the item sets each section needs", async () => {
  const form = await reg.loadForm("ielts-academic/forms/test-01");
  assert.equal(form.sections.length, 4);
  const [lis, rea, wri, spk] = form.sections;
  assert.equal(lis.set.skill, "listening");
  assert.equal(rea.set.passages.length, 2);
  assert.equal(wri.tasks.length, 2);
  assert.equal(wri.tasks[0].task, "task1");
  assert.equal(wri.tasks[1].task, "task2");
  assert.equal(spk.set.parts.length, 3);
});

test("a missing content file fails loudly and is not cached as a success", async () => {
  await assert.rejects(() => reg.item("ielts-academic/listening/does-not-exist"));
  // the cache must not have poisoned a later good read
  assert.ok(await reg.item("ielts-academic/listening/set-01"));
});

/* ---- item types ---- */
test("every registered item type exposes the full interface", () => {
  for (const [name, mod] of itemtypes.types) {
    assert.equal(mod.type, name, `${name} should report its own type`);
    for (const fn of ["render", "collect", "clear", "mark"]) {
      assert.equal(typeof mod[fn], "function", `${name} is missing ${fn}()`);
    }
  }
  assert.deepEqual(itemtypes.known(), ["gap-fill", "mcq-single", "tfng"]);
});

test("an unregistered item type fails with a useful message", () => {
  assert.throws(() => itemtypes.get("reorder-paragraph"), /Unknown item type "reorder-paragraph"/);
});

test("the validator's type list matches the engine registry", () => {
  // the two drift apart silently otherwise
  const src = readFileSync(new URL("../scripts/validate.mjs", import.meta.url), "utf8");
  const listed = [...src.match(/const KNOWN_TYPES = new Set\(\[([^\]]+)\]\)/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(listed.sort(), itemtypes.known());
});

/* ---- marking ---- */
test("gap-fill accepts every spelling the item allows, and ignores noise", () => {
  const q = { id: "l5", type: "gap-fill", answer: ["80", "eighty", "80dollars"], explain: "x" };
  for (const given of ["80", "eighty", "$80", " 80 ", "80.", "80 dollars"]) {
    assert.equal(markOne(q, given).ok, true, `should accept "${given}"`);
  }
  assert.equal(markOne(q, "55").ok, false);
  assert.equal(markOne(q, "").ok, false, "a blank answer is never correct");
  assert.equal(markOne(q, "   ").ok, false);
});

test("answer normalisation matches v1 so old answers keep being accepted", () => {
  assert.equal(norm("The Library"), "library");
  assert.equal(norm("$1,250"), "1250");
  assert.equal(norm("a fish market"), "fishmarket");
  assert.equal(norm("7:15pm"), "7:15pm");
  assert.equal(norm("25."), "25");
});

test("mcq-single marks by index and reports the full answer", () => {
  const q = { id: "l7", type: "mcq-single", options: ["a shipyard", "a fish market", "a library"], answer: 1, explain: "x" };
  assert.equal(markOne(q, "1").ok, true);
  assert.equal(markOne(q, 1).ok, true);
  assert.equal(markOne(q, "0").ok, false);
  assert.equal(markOne(q, "").ok, false);
  assert.equal(markOne(q, "").shown, "B · a fish market");
});

test("tfng marks T/F/NG and shows the word, not the code", () => {
  const q = { id: "r2", type: "tfng", answer: "NG", explain: "x" };
  assert.equal(markOne(q, "NG").ok, true);
  assert.equal(markOne(q, "T").ok, false);
  assert.equal(markOne(q, "").ok, false);
  assert.equal(markOne(q, "T").shown, "NOT GIVEN");
  assert.equal(markOne({ id: "r3", type: "tfng", variant: "ynng", answer: "F" }, "F").shown, "NO");
});

test("marking a whole set counts correct answers and keeps per-question detail", () => {
  const qs = [
    { id: "a", type: "tfng", answer: "T", explain: "because" },
    { id: "b", type: "mcq-single", options: ["x", "y"], answer: 0, explain: "because" },
    { id: "c", type: "gap-fill", answer: ["flowers"], explain: "because" },
  ];
  const r = markAll(qs, { a: "T", b: "1", c: "Flowers" });
  assert.equal(r.correct, 2);
  assert.equal(r.total, 3);
  assert.equal(r.points, 2);
  assert.equal(r.max, 3);
  assert.equal(r.byId.b.ok, false);
  assert.equal(r.byId.b.explain, "because");
  assert.equal(r.byId.c.ok, true);
});

test("unanswered questions are marked wrong, not skipped", () => {
  const qs = [{ id: "a", type: "tfng", answer: "T" }, { id: "b", type: "gap-fill", answer: ["x"] }];
  const r = markAll(qs, {});
  assert.equal(r.correct, 0);
  assert.equal(r.total, 2);
});

/* ---- real content marks correctly ---- */
test("the migrated IELTS sets mark end to end against their own keys", async () => {
  for (const id of ["ielts-academic/listening/set-01", "ielts-academic/reading/set-01"]) {
    const set = await reg.item(id);
    const qs = questionsOf(set);
    assert.ok(qs.length > 0, `${id} should expose questions`);
    // answering with each item's own first accepted answer must score full marks
    const answers = {};
    for (const q of qs) {
      answers[q.id] = q.type === "gap-fill" ? q.answer[0] : q.type === "mcq-single" ? String(q.answer) : q.answer;
    }
    const r = markAll(qs, answers);
    assert.equal(r.correct, qs.length, `${id} should mark its own key as all correct`);
  }
});

test("a speaking set yields no markable questions — the examiner marks it", async () => {
  const set = await reg.item("ielts-academic/speaking/set-01");
  assert.equal(questionsOf(set).length, 0);
  assert.equal(set.parts[0].questions.length, 4);
  assert.equal(typeof set.parts[0].questions[0], "string");
});

test("the migrated listening set still has v1's question count and order", async () => {
  const set = await reg.item("ielts-academic/listening/set-01");
  const qs = questionsOf(set);
  assert.equal(qs.length, 10);
  assert.deepEqual(qs.map((q) => q.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(qs.map((q) => q.type),
    ["gap-fill", "gap-fill", "gap-fill", "gap-fill", "gap-fill", "gap-fill", "mcq-single", "mcq-single", "mcq-single", "mcq-single"]);
});

test("the migrated reading set still has v1's question count and order", async () => {
  const qs = questionsOf(await reg.item("ielts-academic/reading/set-01"));
  assert.equal(qs.length, 13);
  assert.deepEqual(qs.map((q) => q.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(qs.filter((q) => q.type === "tfng").length, 5);
});

/* ---- rubrics ---- */
test("IELTS rubrics carry the official criteria, and say what they cannot judge", async () => {
  const w2 = await reg.rubric("ielts-academic", "writing-task2");
  assert.deepEqual(w2.criteria.map((c) => c.key), ["ta", "cc", "lr", "gra"]);
  assert.equal(w2.criteria[0].name, "Task Response");
  const w1 = await reg.rubric("ielts-academic", "writing-task1");
  assert.equal(w1.criteria[0].name, "Task Achievement");

  const spk = await reg.rubric("ielts-academic", "speaking");
  assert.deepEqual(spk.criteria.map((c) => c.key), ["fc", "lr", "gra"]);
  assert.equal(spk.cannotAssess.length, 1);
  assert.equal(spk.cannotAssess[0].key, "pron");
  assert.match(spk.cannotAssess[0].why, /transcript/);
});

test("every rubric an exam names exists and is loadable", async () => {
  for (const id of ["ielts-academic", "ielts-general"]) {
    const exam = await reg.exam(id);
    for (const s of exam.sections) {
      const names = [s.rubric, ...(s.tasks || []).map((t) => t.rubric)].filter(Boolean);
      for (const n of names) {
        const r = await reg.rubric(id, n);
        assert.ok(Array.isArray(r.criteria) && r.criteria.length, `${id}/${n} should have criteria`);
      }
    }
  }
});

/* ---- tips ---- */
test("every ready exam has tips for all four modules", async () => {
  for (const skill of ["listening", "reading", "writing", "speaking"]) {
    const t = await reg.tips("ielts-academic", skill);
    assert.equal(t.skill, skill);
    assert.ok(t.general.length >= 3, `${skill} tips should be substantive`);
    assert.ok(t.general.every((x) => typeof x.body === "string" && x.body.trim()));
  }
});
