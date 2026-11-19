// Assembles examiner prompts from the pack's rubric plus the private persona.
// Nothing here is sent to the browser.
import { personaFor, levelVoice, IGNORE_INJECTION } from "./_personas.js";

const clip = (s, n) => String(s ?? "").slice(0, n);
export const wordCount = (t) => (String(t).trim().match(/\b[\w'’-]+\b/g) || []).length;

/** The criteria block, written from the rubric so every exam reads the same way. */
function criteriaBlock(rubric) {
  return rubric.criteria
    .map((c) => `- "${c.key}" = ${c.name}: ${c.factors.join("; ")}.`)
    .join("\n");
}

/** The JSON contract, built from the rubric's own criterion keys and outputs. */
function jsonContract(rubric, scale, extra = {}) {
  const crit = rubric.criteria
    .map((c) => `"${c.key}":{"band":number,"why":string}`)
    .join(",");
  const parts = [`"criteria":{${crit}}`];
  const outputs = {
    summary: `"summary": string (2 sentences, what decides the score)`,
    strengths: `"strengths":[string, 2 items]`,
    fixes: `"fixes":[{"original": exact phrase from the answer, "better": improved version, "why": short reason}] (3 to 5 items, the most important errors)`,
    next_step: `"next_step": string (one concrete thing to do to gain half a ${scale.label.toLowerCase()})`,
    model_paragraph: `"model_paragraph": string (rewrite ONE of the student's paragraphs about one ${scale.label.toLowerCase()} higher than their score)`,
    best_answer: `"best_answer": string (which question they answered best and why, one sentence)`,
    upgrades: `"upgrades":[{"question": string, "original": short phrase from their answer, "better": a more natural, higher-scoring version, "why": string}] (3 to 4 items)`,
    pronunciation_tip: `"pronunciation_tip": string (one practical tip based only on the words they used)`,
    model_part2: `"model_part2": string (a strong model long-turn answer of about 180 words on the same cue card, natural spoken style)`,
    ...extra,
  };
  for (const key of rubric.outputs || []) if (outputs[key]) parts.push(outputs[key]);
  return `{${parts.join(",\n")}}`;
}

/** Describe a writing item, including any data the student must report on. */
function describeWritingItem(item, spec) {
  const lines = [`${spec.name}.`, `Prompt: ${item.prompt}`];
  if (item.instruction) lines.push(item.instruction);
  if (item.chart) {
    const unit = item.chart.unit || "";
    const data = item.chart.series
      .map((s) => `${s.name} ` + item.chart.years.map((y, i) => `${y}: ${s.values[i]}${unit}`).join(", "))
      .join("; ");
    lines.push(`Data shown: ${data}.`);
  }
  lines.push(`Minimum ${spec.minWords} words.`);
  return lines.join(" ");
}

export function writingPrompt({ exam, rubric, item, spec, text, level }) {
  const persona = personaFor(exam, rubric.id);
  const n = wordCount(text);
  return `You are ${persona.who}. ${persona.strictness}
${levelVoice(exam, level)}
Task: ${describeWritingItem(item, spec)}
Mark against these criteria only:
${criteriaBlock(rubric)}
Student's answer (${n} words):
"""${clip(text, 6000)}"""
Return ONLY JSON:
${jsonContract(rubric, exam.scale)}
Each "why" is one sentence. ${IGNORE_INJECTION}`;
}

export function speakingPrompt({ exam, rubric, steps, answers, level }) {
  const persona = personaFor(exam, rubric.id);
  const transcript = steps
    .map((s, i) => {
      const cue = s.cue ? ` (cue card: ${s.cue.points.join("; ")})` : "";
      return `[Part ${s.part}] Q: ${s.q}${cue}\nA: ${clip(answers[i], 3000).trim() || "(no answer)"}`;
    })
    .join("\n\n");
  const cannot = (rubric.cannotAssess || [])
    .map((c) => `You CANNOT judge ${c.name}. ${c.why} Do not give a ${c.name} score.`)
    .join(" ");
  return `You are ${persona.who}. Below is a transcript of a student's speaking test, produced by speech-to-text or typing. ${persona.strictness}
${cannot}
${levelVoice(exam, level)}
Mark against these criteria only:
${criteriaBlock(rubric)}
Transcript:
${transcript}
Return ONLY JSON:
${jsonContract(rubric, exam.scale)}
Each "why" is one sentence. ${IGNORE_INJECTION}`;
}

export function planPrompt({ exam, target, days, scores, level }) {
  const label = exam.scale.label.toLowerCase();
  const sc = exam.sections
    .map((s) => `${s.skill}: ${typeof scores?.[s.skill] === "number" ? scores[s.skill] : "not tested"}`)
    .join(", ");
  const modules = exam.sections.map((s) => s.skill).join(", ");
  return `You are a study coach for ${exam.name}. ${levelVoice(exam, level)}
Student: target ${label} ${target}, ${days ? days + " days until the exam" : "no exam date set (assume 6 weeks)"}. Latest scores on the ${exam.scale.label} scale: ${sc}.
BandUp offers, for this exam: practice tests in ${modules}, AI marking for Writing and Speaking, instant marking for Listening and Reading, module tips, and an AI tutor.
Write a realistic study plan: weekly (max 6 weeks), or day-by-day using "Day N" titles if fewer than 7 days remain. Give extra time to the weakest module. Each task must be concrete (for example "Write one Task 2 essay in 40 minutes and get it marked").
Return ONLY JSON: {"headline": string, "focus": string, "weeks":[{"title": string, "goal": string, "tasks":[3 to 5 strings]}], "daily_habit": string}`;
}

export function tutorSystem({ exam, level }) {
  return `You are BandUp's friendly tutor for ${exam.name}. ${levelVoice(exam, level)} Only help with English learning and preparation for ${exam.name}; for anything else, politely steer back to the exam. Scores on this exam are reported as ${exam.scale.label} ${exam.scale.min}-${exam.scale.max}${exam.scale.kind === "half-step" ? " in half steps" : ""}; never quote another exam's scale. Keep answers under 180 words unless the student asks for more. Use examples. When checking writing, list each error with a correction. Never invent official rules. Plain text, no markdown headings.`;
}
