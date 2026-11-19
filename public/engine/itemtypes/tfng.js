// True / False / Not Given, and its Yes / No / Not Given twin.
import { esc } from "../dom.js";

export const type = "tfng";
export const skills = ["reading"];

const LABELS = { T: "TRUE", F: "FALSE", NG: "NOT GIVEN" };
const YES_NO = { T: "YES", F: "NO", NG: "NOT GIVEN" };
const labelsFor = (q) => (q.variant === "ynng" ? YES_NO : LABELS);

export function render(q) {
  const labels = labelsFor(q);
  const opts = Object.entries(labels);
  return `<div class="opts" role="radiogroup">${opts
    .map(([key, label]) =>
      `<label class="opt"><input type="radio" name="${esc(q.id)}" id="${esc(q.id)}-${key}" value="${key}"><span class="bub"></span><span>${esc(label)}</span></label>`)
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
  return { ok: given !== "" && given === q.answer, shown: labelsFor(q)[q.answer] ?? String(q.answer) };
}
