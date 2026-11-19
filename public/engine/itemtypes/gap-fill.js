// Typed answer into a gap. Any of the item's accepted spellings counts.
import { esc, norm } from "../dom.js";

export const type = "gap-fill";
export const skills = ["listening", "reading"];

export function render(q) {
  return `${q.prefix ? `<span>${esc(q.prefix)}</span>` : ""}<input class="gap" id="${esc(q.id)}" autocomplete="off" aria-label="Answer ${q.n}">`;
}

export function collect(q, doc = document) {
  const el = doc.getElementById(q.id);
  return el ? el.value : "";
}

export function clear(q, doc = document) {
  const el = doc.getElementById(q.id);
  if (el) el.value = "";
}

export function mark(q, given) {
  const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
  const ok = String(given ?? "").trim() !== "" && answers.some((a) => norm(a) === norm(given));
  return { ok, shown: String(answers[0]) };
}
