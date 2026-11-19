// Multiple choice, exactly one correct option. `answer` is a 0-based index.
import { esc } from "../dom.js";

export const type = "mcq-single";
export const skills = ["listening", "reading"];
const LETTER = "ABCDEFGH";

export function render(q) {
  return `<div class="opts col" role="radiogroup">${q.options
    .map((label, i) =>
      `<label class="opt"><input type="radio" name="${esc(q.id)}" id="${esc(q.id)}-${LETTER[i]}" value="${i}"><span class="bub">${LETTER[i]}</span><span>${esc(label)}</span></label>`)
    .join("")}</div>`;
}

export function collect(q, doc = document) {
  const r = doc.querySelector(`input[name="${q.id}"]:checked`);
  return r ? r.value : "";
}

export function clear(q, doc = document) {
  doc.querySelectorAll(`input[name="${q.id}"]`).forEach((r) => { r.checked = false; });
}

export function mark(q, given) {
  const ok = given !== "" && given !== null && Number(given) === Number(q.answer);
  return { ok, shown: `${LETTER[q.answer]} · ${q.options[q.answer]}` };
}
