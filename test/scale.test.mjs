// Score-scale maths, checked against the exam boards' own published worked examples.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  roundHalfBand, clamp, snap, format, fraction,
  fromRaw, aggregate, hasOfficialOverall, comparable, text,
} from "../public/engine/scale.js";

const ielts = { kind: "half-step", min: 0, max: 9, step: 0.5, label: "Band", format: "Band {v}",
                overall: { method: "mean-round-half-band" } };
const celpip = { kind: "integer", min: 0, max: 12, step: 1, label: "Level", format: "Level {v}",
                 overall: { method: "none" } };
const pte = { kind: "points", min: 10, max: 90, step: 1, label: "Score", format: "{v}",
              overall: { method: "none" } };
const toefl = { kind: "half-step", min: 1, max: 6, step: 0.5, label: "Band", format: "Band {v}",
                overall: { method: "mean-round-half-band" },
                comparable: { scale: "0-120", until: "2028-01",
                  table: [[6,114],[5.5,107],[5,95],[4.5,86],[4,72],[3.5,58],[3,44],[2.5,34],[2,24],[1.5,12],[1,0]] } };

test("IELTS overall matches the official worked examples", () => {
  // ielts.com.au/australia/results/band-score-calculation
  const m = (v) => aggregate(v, "mean-round-half-band", ielts);
  assert.equal(m([6.5, 6.5, 5.0, 7.0]), 6.5);   // avg 6.25
  assert.equal(m([4.0, 4.5, 4.0, 4.0]), 4.0);   // avg 4.125
  assert.equal(m([6.5, 6.5, 5.5, 6.0]), 6.0);   // avg 6.125
});

test("TOEFL overall matches the official worked examples", () => {
  const m = (v) => aggregate(v, "mean-round-half-band", toefl);
  assert.equal(m([5.5, 5.5, 5, 5]), 5.5);       // avg 5.25  -> ETS: 5.5
  assert.equal(m([5.5, 5, 5, 5]), 5);           // avg 5.125 -> ETS: 5
});

test("half-band rounding handles the exact boundaries", () => {
  assert.equal(roundHalfBand(6.0), 6);
  assert.equal(roundHalfBand(6.24), 6);
  assert.equal(roundHalfBand(6.25), 6.5);       // .25 rounds up to the half
  assert.equal(roundHalfBand(6.74), 6.5);
  assert.equal(roundHalfBand(6.75), 7);         // .75 rounds up to the whole
  assert.equal(roundHalfBand(-1), -1);
  assert.equal(roundHalfBand("nonsense"), null);
});

test("IELTS Writing weights Task 2 twice as heavily as Task 1", () => {
  const w = (vals) => aggregate(vals, "weighted-mean-round-half-band", ielts, { weights: [1, 2] });
  assert.equal(w([5, 7]), 6.5);                 // (5 + 14) / 3 = 6.333 -> 6.5
  assert.equal(w([7, 5]), 5.5);                 // (7 + 10) / 3 = 5.666 -> 5.5
  // and it is genuinely different from an unweighted mean
  assert.notEqual(w([5, 7]), aggregate([5, 7], "mean-round-half-band", ielts));
});

test("CELPIP levels stay whole numbers inside 0-12", () => {
  assert.equal(snap(8.4, celpip), 8);
  assert.equal(snap(8.5, celpip), 9);
  assert.equal(clamp(15, celpip), 12);
  assert.equal(clamp(-3, celpip), 0);
  assert.equal(format(9, celpip), "Level 9");
});

test("PTE points stay whole numbers inside 10-90", () => {
  assert.equal(snap(72.4, pte), 72);
  assert.equal(clamp(95, pte), 90);
  assert.equal(clamp(2, pte), 10);
  assert.equal(format(72, pte), "72");
});

test("exams that publish no overall return null, not a made-up number", () => {
  assert.equal(aggregate([9, 8, 10, 9], "none", celpip), null);
  assert.equal(hasOfficialOverall(celpip), false);
  assert.equal(hasOfficialOverall(pte), false);
  assert.equal(hasOfficialOverall(ielts), true);
  assert.equal(hasOfficialOverall(toefl), true);
});

test("holistic marking uses the rater's own level, not a mean of criteria", () => {
  // CELPIP raters award one level per skill; the four dimensions are evidence.
  const r = aggregate([9, 7, 8, 10], "holistic", celpip, { holisticValue: 8 });
  assert.equal(r, 8);
  assert.equal(aggregate([9, 7], "holistic", celpip, { holisticValue: null }), null);
});

test("an unknown aggregate method fails loudly instead of guessing", () => {
  assert.throws(() => aggregate([6, 7], "vibes", ielts), /Unknown aggregate method/);
});

test("TOEFL reports a comparable 0-120 total during the transition", () => {
  assert.deepEqual(comparable(5.5, toefl), { scale: "0-120", value: 107, until: "2028-01" });
  assert.deepEqual(comparable(4, toefl), { scale: "0-120", value: 72, until: "2028-01" });
  assert.equal(comparable(6, ielts), null);     // IELTS has no second scale
});

test("the bare number is written the way each exam writes it", () => {
  assert.equal(text(6.5, ielts), "6.5");
  assert.equal(text(7, ielts), "7.0");
  assert.equal(text(9, celpip), "9");
  assert.equal(text(72, pte), "72");
  assert.equal(text(null, ielts), "–");
});

test("formatting and progress fractions work on every scale", () => {
  assert.equal(format(6.5, ielts), "Band 6.5");
  assert.equal(format(7, ielts), "Band 7.0");
  assert.equal(format(null, ielts), "–");
  assert.equal(fraction(0, ielts), 0);
  assert.equal(fraction(9, ielts), 1);
  assert.equal(fraction(10, pte), 0);           // PTE floor is 10, not 0
  assert.equal(fraction(90, pte), 1);
});

/* ---- the real packs on disk ---- */
const load = (id) => JSON.parse(readFileSync(new URL(`../public/content/exams/${id}/exam.json`, import.meta.url)));
const academic = load("ielts-academic");
const general = load("ielts-general");
const sec = (exam, skill) => exam.sections.find((s) => s.skill === skill);

test("IELTS Listening raw scores hit the published anchors", () => {
  const listening = sec(academic, "listening");
  assert.equal(fromRaw(16, listening).score, 5);
  assert.equal(fromRaw(23, listening).score, 6);
  assert.equal(fromRaw(30, listening).score, 7);
  assert.equal(fromRaw(35, listening).score, 8);
  assert.equal(fromRaw(0, listening).score, 2);   // never returns null
});

test("IELTS Academic Reading raw scores hit the published anchors", () => {
  const reading = sec(academic, "reading");
  assert.equal(fromRaw(15, reading).score, 5);
  assert.equal(fromRaw(23, reading).score, 6);
  assert.equal(fromRaw(30, reading).score, 7);
  assert.equal(fromRaw(35, reading).score, 8);
  assert.equal(fromRaw(39, reading).score, 9);
});

test("General Training Reading is harder than Academic for the same band", () => {
  // This is the v1 bug: one shared table. GT needs more correct answers.
  const gt = sec(general, "reading");
  assert.equal(fromRaw(23, gt).score, 5);
  assert.equal(fromRaw(30, gt).score, 6);
  assert.equal(fromRaw(34, gt).score, 7);
  assert.equal(fromRaw(37, gt).score, 8);
  assert.equal(fromRaw(40, gt).score, 9);
  // 30 correct answers is band 7 on Academic but only band 6 on General Training
  assert.equal(fromRaw(30, sec(academic, "reading")).score, 7);
  assert.equal(fromRaw(30, gt).score, 6);
});

test("a short practice set is scaled up to the exam's full question count", () => {
  const reading = { raw: { ...sec(academic, "reading").raw, asked: 13 } };
  const r = fromRaw(13, reading);              // all 13 right
  assert.equal(r.raw, 40);
  assert.equal(r.outOf, 40);
  assert.equal(r.score, 9);
  const part = fromRaw(7, reading);            // 7 of 13 right
  assert.equal(part.raw, 22);                  // scaled to 22 of 40
  assert.equal(part.score, 5.5);               // the Academic table puts 19+ at band 5.5
});

test("IELTS Listening and Speaking are shared between Academic and General Training", () => {
  assert.equal(sec(general, "listening").sharesItemsWith, "ielts-academic");
  assert.equal(sec(general, "speaking").sharesItemsWith, "ielts-academic");
  assert.deepEqual(sec(general, "listening").raw.table, sec(academic, "listening").raw.table);
});
