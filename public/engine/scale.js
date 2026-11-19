// Score scales as data.
//
// This module knows about KINDS of scale, never about named exams. IELTS bands,
// CELPIP levels, PTE points and TOEFL bands are all expressed as `scale` objects
// in content/exams/<id>/exam.json and behave correctly here without new branches.
//
// Shared by the browser (public/app.js) and the server (api/*).

/** Scale kinds we support. An exam using one of these needs no engine changes. */
export const KINDS = ["half-step", "integer", "points"];

/* ---------------- rounding ---------------- */

/**
 * Round onto the nearest half band, using the published IELTS/TOEFL rule:
 * a fraction below .25 rounds down, .25–.74 rounds to the half, .75+ rounds up.
 * Official IELTS worked examples: 6.25 -> 6.5, 4.125 -> 4.0, 6.125 -> 6.0.
 * Official ETS worked examples:   5.25 -> 5.5, 5.125 -> 5.0.
 */
export function roundHalfBand(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  const f = Math.floor(n), d = n - f;
  return d < 0.25 ? f : d < 0.75 ? f + 0.5 : f + 1;
}

/** Round to a whole number (CELPIP levels are integers). */
export function roundInteger(x) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Keep a value inside a scale's own range, and on its own step. */
export function clamp(value, scale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const lo = Number(scale.min), hi = Number(scale.max);
  let v = Math.min(hi, Math.max(lo, n));
  if (scale.kind === "integer") v = roundInteger(v);
  else if (scale.kind === "half-step") v = Math.round(v * 2) / 2;
  else if (scale.kind === "points") v = Math.round(v);
  return Math.min(hi, Math.max(lo, v));
}

/** Snap an arbitrary value onto the scale's grid, respecting its kind. */
export function snap(value, scale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (scale.kind === "half-step") return clamp(roundHalfBand(n), scale);
  if (scale.kind === "integer") return clamp(roundInteger(n), scale);
  return clamp(n, scale);
}

/* ---------------- display ---------------- */

/**
 * The bare number, written the way that exam writes it: half-step scales always
 * show one decimal ("6.5", "7.0"), integer and point scales never do.
 */
export function text(value, scale) {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return scale.kind === "half-step" ? n.toFixed(1) : String(Math.round(n));
}

/**
 * Render a value the way that exam's score report does.
 * `scale.format` is a template containing {v}, e.g. "Band {v}" or "Level {v}".
 */
export function format(value, scale) {
  const t = text(value, scale);
  return t === "–" ? t : (scale.format || "{v}").replace("{v}", t);
}

/** Position on the scale as 0–1, for progress bars that work on any scale. */
export function fraction(value, scale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const lo = Number(scale.min), hi = Number(scale.max);
  if (hi === lo) return 0;
  return Math.min(1, Math.max(0, (n - lo) / (hi - lo)));
}

/* ---------------- raw answers -> score ---------------- */

/**
 * Convert a raw number of correct answers into a score using the exam's own
 * table. `table` is [[minRaw, score], ...] in descending minRaw order.
 * `outOf` lets a short practice set be scaled to the exam's full question count
 * (a 13-question set still reports against a 40-question table).
 */
export function fromRaw(correct, section) {
  const table = section?.raw?.table;
  if (!Array.isArray(table) || !table.length) return null;
  const total = Number(section.raw.outOf) || 0;
  const asked = Number(section.raw.asked ?? total) || total;
  if (!asked || !total) return null;
  const scaled = Math.round((Number(correct) / asked) * total);
  for (const [minRaw, score] of table) if (scaled >= minRaw) return { score, raw: scaled, outOf: total };
  const last = table[table.length - 1];
  return { score: last[1], raw: scaled, outOf: total };
}

/* ---------------- aggregation ---------------- */

/**
 * Combine several scores into one, by the method the exam actually uses.
 * Methods are named in exam.json / rubric.json, so a new exam picks one
 * rather than adding code.
 *
 *   mean-round-half-band          IELTS and TOEFL overall, IELTS speaking criteria
 *   weighted-mean-round-half-band IELTS Writing (Task 2 counts twice)
 *   mean-round-integer            an integer-scale mean, if an exam ever needs one
 *   holistic                      rater gives one value; criteria are evidence, not terms
 *   trait-estimate                clearly-labelled estimate (PTE); never the exam's own overall
 *   none                          the exam publishes no combined score (CELPIP, PTE)
 */
export function aggregate(values, method, scale, opts = {}) {
  if (method === "none") return null;

  if (method === "holistic") {
    const v = opts.holisticValue;
    return v === null || v === undefined ? null : clamp(v, scale);
  }

  const nums = (values || []).map(Number).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;

  if (method === "weighted-mean-round-half-band") {
    const w = (opts.weights || []).map(Number);
    let sum = 0, tw = 0;
    nums.forEach((n, i) => { const wi = Number.isFinite(w[i]) ? w[i] : 1; sum += n * wi; tw += wi; });
    return tw ? clamp(roundHalfBand(sum / tw), scale) : null;
  }

  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;

  if (method === "mean-round-half-band") return clamp(roundHalfBand(mean), scale);
  if (method === "mean-round-integer") return clamp(roundInteger(mean), scale);
  if (method === "trait-estimate") return clamp(mean, scale);

  throw new Error(`Unknown aggregate method: ${method}`);
}

/**
 * True when an exam publishes no combined score of its own, so the UI must show
 * per-skill scores only (CELPIP publishes none; Pearson states the PTE overall
 * is not an average of the four communicative skills).
 */
export function hasOfficialOverall(scale) {
  const m = scale?.overall?.method;
  return !!m && m !== "none";
}

/**
 * Secondary figure some exams report alongside their main scale, e.g. TOEFL's
 * comparable 0–120 total during the two-year transition after January 2026.
 * `table` is [[score, comparable], ...].
 */
export function comparable(value, scale) {
  const c = scale?.comparable;
  if (!c || !Array.isArray(c.table) || value === null || value === undefined) return null;
  const n = Number(value);
  let hit = null;
  for (const [score, out] of c.table) if (n >= Number(score)) { hit = out; break; }
  return hit === null ? null : { scale: c.scale, value: hit, until: c.until || null };
}
