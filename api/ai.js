// POST /api/ai — the AI examiner, study coach and tutor.
//
// The browser sends an exam id, a mode and a stable item id. It never sends
// practice content and never sees a prompt: the server loads the item from
// public/content/ and builds the examiner prompt here. That is what stops the
// public site being used as a free general-purpose AI proxy.
import { registry, assertContentDeployed } from "./_packs.js";
import { JSON_SYSTEM } from "./_personas.js";
import { writingPrompt, speakingPrompt, planPrompt, tutorSystem, wordCount } from "./_prompt.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL_MARK = process.env.MODEL_MARK || "claude-sonnet-5-5"; // writing + speaking marking
const MODEL_FAST = process.env.MODEL_FAST || "claude-haiku-5-5"; // tutor + study plan
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 25); // AI calls per visitor per day, across all exams

/* ---------- rate limiting ---------- */
const memory = new Map(); // fallback, per server instance only
async function overLimit(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `bandup:${day}:${ip}`;
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const r = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["EXPIRE", key, 90000]]),
      });
      const j = await r.json();
      return Number(j?.[0]?.result || 0) > DAILY_LIMIT;
    } catch { /* fall through to memory */ }
  }
  const n = (memory.get(key) || 0) + 1;
  memory.set(key, n);
  if (memory.size > 5000) memory.clear();
  return n > DAILY_LIMIT;
}

/* ---------- helpers ---------- */
const clip = (s, n) => String(s ?? "").slice(0, n);
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status, msg });

async function claude({ model, prompt, messages, system, maxTokens = 2000 }) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: messages || [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    console.error("Anthropic error", r.status, detail.slice(0, 500));
    throw Object.assign(new Error("upstream"), { status: r.status === 429 ? 429 : 502 });
  }
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

function parseJSON(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw Object.assign(new Error("bad json"), { status: 502 });
  return JSON.parse(text.slice(a, b + 1));
}

/** Load the exam, and refuse anything the pack does not actually contain. */
async function examOf(body) {
  const examId = String(body.examId || "");
  if (!/^[a-z0-9-]{1,40}$/.test(examId)) throw bad("Unknown exam.");
  try { return await registry.exam(examId); }
  catch { throw bad("Unknown exam."); }
}

/** An item id must belong to a real pack; that is how the server stays in control. */
async function itemOf(exam, body, skill) {
  const itemId = String(body.itemId || "");
  if (!/^[a-z0-9/-]{1,120}$/.test(itemId)) throw bad("Unknown task.");
  let item;
  try { item = await registry.item(itemId); }
  catch { throw bad("Unknown task."); }
  if (item.skill !== skill) throw bad("Unknown task.");
  const source = (exam.sections.find((s) => s.skill === skill) || {}).sharesItemsWith || exam.id;
  if (itemId.split("/")[0] !== source) throw bad("Unknown task.");
  return item;
}

/* ---------- modes ---------- */
async function writing(body) {
  const exam = await examOf(body);
  const item = await itemOf(exam, body, "writing");
  const section = exam.sections.find((s) => s.skill === "writing");
  const spec = section.tasks.find((t) => t.id === item.task);
  if (!spec) throw bad("Unknown task.");
  const rubric = await registry.rubric(exam.id, spec.rubric);

  const text = clip(body.text, 6000).trim();
  if (wordCount(text) < 40) throw bad("Write at least a few sentences first.");

  const prompt = writingPrompt({ exam, rubric, item, spec, text, level: body.level });
  return parseJSON(await claude({ model: MODEL_MARK, prompt, system: JSON_SYSTEM, maxTokens: 2500 }));
}

async function speaking(body) {
  const exam = await examOf(body);
  const item = await itemOf(exam, body, "speaking");
  const section = exam.sections.find((s) => s.skill === "speaking");
  const rubric = await registry.rubric(exam.id, section.rubric);

  // Rebuild the question order from the pack, not from anything the browser sent.
  const steps = item.parts.flatMap((part) =>
    part.cue ? [{ part: part.n, q: part.cue.topic, cue: part.cue }]
             : (part.questions || []).map((q) => ({ part: part.n, q })));

  const answers = Array.isArray(body.answers) ? body.answers : [];
  const filled = steps.filter((_, i) => clip(answers[i], 3000).trim()).length;
  if (filled < 3) throw bad("Answer at least three questions first.");

  const prompt = speakingPrompt({ exam, rubric, steps, answers, level: body.level });
  return parseJSON(await claude({ model: MODEL_MARK, prompt, system: JSON_SYSTEM, maxTokens: 2500 }));
}

async function plan(body) {
  const exam = await examOf(body);
  const sc = exam.scale;
  const target = Math.max(sc.min, Math.min(sc.max, Number(body.target) || sc.min + (sc.max - sc.min) * 0.7));
  const days = Number(body.days) > 0 ? Math.min(365, Math.round(Number(body.days))) : null;
  const prompt = planPrompt({ exam, target, days, scores: body.scores, level: body.level });
  return parseJSON(await claude({ model: MODEL_FAST, prompt, system: JSON_SYSTEM, maxTokens: 1800 }));
}

async function tutor(body) {
  const exam = await examOf(body);
  let msgs = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-10)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: clip(m.content, 3000) }))
    .filter((m) => m.content.trim());
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw bad("Type a question first.");
  const system = tutorSystem({ exam, level: body.level });
  return { text: await claude({ model: MODEL_FAST, messages: msgs, system, maxTokens: 900 }) };
}

// A Map, not an object literal: on an object, a mode of "constructor" or
// "toString" would resolve to an inherited function and be called.
const MODES = new Map([["writing", writing], ["speaking", speaking], ["plan", plan], ["tutor", tutor]]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "The site owner has not added an AI key yet." });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : req.body || {};
  const fn = MODES.get(body.mode);
  if (!fn) return res.status(400).json({ error: "Unknown request." });
  try { assertContentDeployed(); }
  catch (e) { console.error(e); return res.status(500).json({ error: e.msg }); }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  if (await overLimit(ip)) return res.status(429).json({ error: `You have used today's ${DAILY_LIMIT} free AI checks. Come back tomorrow. Listening and Reading are unlimited.` });
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(await fn(body));
  } catch (e) {
    const status = e.status || 500;
    const msg = e.msg || (status === 429 ? "The AI examiner is busy. Try again in a minute." : "The AI examiner could not finish. Please try again.");
    if (status === 500) console.error(e);
    return res.status(status).json({ error: msg });
  }
}
