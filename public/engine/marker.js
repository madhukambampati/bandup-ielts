// Objective marking. Runs in the browser, so Listening and Reading stay instant,
// unlimited and free — and the answer key, not a language model, decides the score.
import * as itemtypes from "./itemtypes/index.js";

/**
 * Score one question.
 * An item type may export `score(q, given) -> { points, max }` when it needs
 * partial credit (PTE's multi-answer items, dictation). Otherwise a question is
 * worth one mark, which is how IELTS, CELPIP and TOEFL objective items work.
 *
 * `scoring.penaliseWrong` subtracts marks for wrong selections, as PTE does on
 * Multiple Choice Multiple Answers and Highlight Incorrect Words.
 */
export function markOne(q, given) {
  const mod = itemtypes.get(q.type);
  const { ok, shown } = mod.mark(q, given);
  let points = ok ? 1 : 0;
  let max = 1;

  if (typeof mod.score === "function") {
    const s = mod.score(q, given);
    points = s.points;
    max = s.max;
    if (q.scoring?.penaliseWrong && typeof s.wrong === "number") points -= s.wrong;
    if (q.scoring?.floor !== undefined) points = Math.max(q.scoring.floor, points);
    else points = Math.max(0, points);
  }

  return { id: q.id, type: q.type, ok, shown, points, max, given: String(given ?? ""), explain: q.explain || "" };
}

/** Score a whole set. `answers` maps question id -> the student's raw answer. */
export function markAll(questions, answers) {
  const results = questions.map((q) => markOne(q, answers?.[q.id]));
  const points = results.reduce((a, r) => a + r.points, 0);
  const max = results.reduce((a, r) => a + r.max, 0);
  return {
    results,
    correct: results.filter((r) => r.ok).length,
    total: questions.length,
    points,
    max,
    byId: Object.fromEntries(results.map((r) => [r.id, r])),
  };
}

/**
 * Pull every markable question out of an item set, whatever shape it uses.
 * Speaking sets hold prompt strings rather than question objects, so they
 * yield nothing here — they are marked by the AI examiner, not the key.
 */
export function questionsOf(set) {
  const all = Array.isArray(set?.questions) ? set.questions
    : Array.isArray(set?.parts) ? set.parts.flatMap((p) => p.questions || [])
    : [];
  return all.filter((q) => q && typeof q === "object" && q.type);
}
