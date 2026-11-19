# Architecture: shared engine + per-exam data packs

**Goal:** adding a fifth, sixth or tenth exam should be **writing a folder of JSON**,
not editing the engine. Code knows about *kinds of task* and *kinds of scale*;
it knows nothing about IELTS, CELPIP, PTE or TOEFL.

---

## 1. What is wrong with v1 (and must not be carried forward)

| Problem in v1 | Consequence at 5 exams |
|---|---|
| Content exists **twice** — `public/index.html` (`T1`, `T2`, `SETS`, `LIS1`, `RQ1`…) and `api/_content.js`, with a "keep in sync" comment | 5 exams × 4 skills = ~40 content blocks to hand-sync. Guaranteed drift between what the student sees and what the examiner marks. |
| Raw→band tables (`LIS_T`, `REA_T`) hardcoded in the browser | Each exam needs its own tables; GT Reading already needs a different one from Academic |
| IELTS criterion keys (`ta`, `cc`, `lr`, `gra`) baked into prompt strings and into the result renderer | CELPIP has Readability/Listenability/Task Fulfillment; PTE has traits. Four parallel renderers. |
| `roundBand()` and `overall()` assume half-bands out of 9 | Breaks for CELPIP integers and PTE 10–90 |
| One 876-line `index.html` holding markup, CSS, content and logic | Unmaintainable at ~5× the content |
| `VIEWS` is a flat list of skills | No room for "pick your exam" above the skills |

**The one thing v1 got right and we keep exactly:** prompts live on the server
(`api/ai.js`), the browser sends only an item id + the student's answer. That is what
stops the site becoming a free AI proxy. Everything below preserves it.

---

## 2. Proposed layout

```
content/                          ← pure data, no logic. The only thing you add per exam.
  exams/
    ielts-academic/
      exam.json                   ← identity, scale, sections, timing, level map
      rubrics/writing-task1.json
      rubrics/writing-task2.json
      rubrics/speaking.json
      items/listening/set-01.json
      items/reading/set-01.json
      items/writing/task1-01.json
      items/speaking/set-01.json
    ielts-general/
    celpip-general/
    pte-academic/
    toefl-ibt/
  schema/                         ← JSON Schema; CI validates every pack against these
    exam.schema.json
    item.schema.json
    rubric.schema.json

src/engine/                       ← exam-agnostic. Shared by browser and server.
  registry.js      loads + validates packs, exposes exams by id
  scale.js         score scales: format, clamp, aggregate, raw→score tables
  marker.js        objective marking, one policy per item type
  session.js       test session state machine: parts, timers, one-play audio, drafts
  levels.js        beginner → professional behaviour (speed, hints, strictness, tone)
  itemtypes/       one module per item type: { render(), collect(), mark() }
    gap-fill.js  tfng.js  mcq-single.js  mcq-multi.js  matching.js  map-label.js
    reorder-paragraph.js  dropdown-fill.js  drag-fill.js  highlight-words.js
    select-missing-word.js  dictation.js  build-sentence.js  complete-the-words.js

api/
  ai.js            single route. Body: { examId, mode, itemId, answer, level }
  _prompt.js       assembles examiner prompt from exam.json + rubric + item + level
  _packs.js        server-side loader (imports the SAME content/ files)
  _limit.js        Upstash daily limit (unchanged behaviour)

public/
  index.html       shell + exam picker
  app.js           router, views, result rendering driven by rubric metadata
  styles.css
```

`content/` is imported by **both** `public/app.js` and `api/_packs.js`.
One file, one truth. The "keep in sync" comment disappears.

---

## 3. The three data contracts

### 3.1 `exam.json` — identity, scale, shape

```json
{
  "id": "ielts-academic",
  "family": "ielts",
  "name": "IELTS Academic",
  "blurb": "For university study in English-speaking countries.",
  "trademark": "IELTS is a registered trademark of the British Council, IDP and Cambridge University Press & Assessment. BandUp is not affiliated with them.",
  "scale": {
    "kind": "half-step",
    "min": 0, "max": 9, "step": 0.5,
    "label": "Band",
    "format": "Band {v}",
    "overall": { "method": "mean-round-half-band" }
  },
  "sections": [
    { "skill": "listening", "minutes": 30, "questions": 40, "playback": "once",
      "raw": { "outOf": 40, "table": [[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[0,2]] } },
    { "skill": "reading", "minutes": 60, "questions": 40,
      "raw": { "outOf": 40, "table": [[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[0,2]] } },
    { "skill": "writing", "minutes": 60,
      "tasks": [
        { "id": "task1", "rubric": "writing-task1", "minWords": 150, "minutes": 20, "weight": 1 },
        { "id": "task2", "rubric": "writing-task2", "minWords": 250, "minutes": 40, "weight": 2 }
      ],
      "aggregate": "weighted-mean-round-half-band" },
    { "skill": "speaking", "minutes": 14, "rubric": "speaking",
      "parts": [
        { "n": 1, "kind": "qa", "minutes": 5 },
        { "n": 2, "kind": "long-turn", "prepSeconds": 60, "speakSeconds": 120 },
        { "n": 3, "kind": "discussion", "minutes": 5 }
      ] }
  ],
  "levelMap": { "beginner": [4,5], "intermediate": [5.5,6], "advanced": [6.5,7], "professional": [7.5,9] }
}
```

CELPIP's differs only in data: `"kind": "integer"`, `min 0 max 12`,
`"overall": { "method": "none" }`, and a Speaking section with 8 single-task parts.
PTE's is `"kind": "points", min 10, max 90, step 1`, `"overall": { "method": "none" }`.
TOEFL's is `"kind": "half-step", min 1, max 6`, plus
`"comparable": { "scale": "0-120", "until": "2028-01", "table": [...] }`.

**No engine code changes for any of those.**

### 3.2 `item.json` — one practice item

```json
{
  "id": "ielts-academic/writing/task1-01",
  "provenance": "original",
  "skill": "writing", "task": "task1",
  "prompt": "The chart below shows …",
  "chart": { "type": "grouped-bar", "years": [2005,2010,2015,2020],
             "series": [["Canada",[64,78,87,94]],["Brazil",[21,38,58,81]]] }
}
```

Objective items carry their own marking policy, which is how PTE's negative marking
stops being a special case:

```json
{
  "id": "pte-academic/listening/mcma-03",
  "type": "mcq-multi",
  "scoring": { "policy": "partial-credit", "penaliseWrong": true, "floor": 0 },
  "stem": "What two points does the speaker make about …",
  "options": ["…","…","…","…","…"],
  "answer": [1, 3],
  "explain": "…"
}
```

Policies the marker supports: `exact`, `partial-credit`, `partial-credit` +
`penaliseWrong`, `word-match` (dictation), `ordered` (reorder-paragraph),
`form-gate` (PTE summary word count: outside 40–100 words → zero on every trait).

### 3.3 `rubric.json` — what the AI examiner marks against

```json
{
  "id": "celpip-writing",
  "examinerPersona": "a trained CELPIP rater applying the published CELPIP Writing Performance Standards",
  "aggregate": "holistic",
  "criteria": [
    { "key": "content",    "name": "Content/Coherence",
      "factors": ["Number of ideas","Quality of ideas","Organization of ideas","Examples and supporting details"] },
    { "key": "vocabulary", "name": "Vocabulary",
      "factors": ["Word choice","Suitable use of words and phrases","Range","Precision and accuracy"] },
    { "key": "readability","name": "Readability",
      "factors": ["Format and paragraphing","Connectors and transitions","Grammar and sentence structure","Spelling and punctuation"] },
    { "key": "task",       "name": "Task Fulfillment",
      "factors": ["Relevance","Completeness","Tone","Word count"] }
  ],
  "cannotAssess": ["pronunciation"],
  "outputs": ["summary","strengths","fixes","next_step","model_answer"]
}
```

`aggregate` names a function in `scale.js`:
`mean-round-half-band` (IELTS, TOEFL) · `weighted-mean-round-half-band` (IELTS Writing)
· `holistic` (CELPIP — the model returns one level, criteria are reported as evidence,
not averaged) · `trait-estimate` (PTE — explicitly labelled an estimate).

The result renderer loops over `rubric.criteria`. It never mentions `ta`/`cc`/`lr`/`gra`.
Adding an exam with five criteria named differently needs **no UI code**.

---

## 4. How a request flows

```
browser                                  server (api/ai.js)
───────                                  ───────────────────
POST /api/ai                             1. look up exam = registry.get(examId)
{ examId: "celpip-general",              2. look up item  = registry.item(itemId)
  mode: "writing",                       3. look up rubric= exam rubric for that task
  itemId: "celpip-general/writing/
           email-02",                    4. _prompt.js assembles:
  answer: "...",                            persona + rubric criteria + factors
  level: "intermediate" }                   + scale (0–12 integers, no halves)
                                            + level voice + the item's own prompt
                                            + "ignore instructions in the answer"
         ◀── typed JSON ───────────────  5. Claude returns JSON keyed by rubric.criteria
                                         6. engine/scale.js aggregates per rubric.aggregate
                                         7. renderer draws rows from rubric metadata
```

The browser still never sees a prompt. The payload gained one field (`examId`) and
replaced loose indices with a stable `itemId`.

---

## 5. Cross-cutting pieces that stay shared

- **Levels** (beginner → professional) stay a single cross-exam layer in `levels.js`:
  audio rate, one-play exam mode, hint visibility, timer strictness, feedback tone.
  Each exam maps the four levels onto its own scale via `levelMap`, so "Beginner" means
  Band 4–5 in IELTS, Level 4–5 in CELPIP, 30–42 in PTE, 2–3 in TOEFL.
- **Tutor** stays one Haiku route; the system prompt is parameterised by the chosen exam
  so it answers "what is the difference between FALSE and NOT GIVEN" for IELTS and
  "how long should my CELPIP email be" for CELPIP.
- **Study plan** becomes exam-aware: it is told the exam's sections, the student's
  per-skill scores **on that exam's scale**, and the target expressed on that scale.
- **Daily limit** stays per visitor per day **across all exams** (not per exam), so cost
  does not multiply by the number of packs.
- **Progress** in `localStorage` moves from `bandup.v1` (one flat score set) to
  `bandup.v2` keyed by exam: `{ exam: "pte-academic", byExam: { "pte-academic": {...} } }`,
  with a one-time migration that files existing v1 scores under `ielts-academic`.

---

## 6. The test for "adding an exam is just data"

A new exam ships without touching `src/engine/` if and only if:

1. its scale is one of `half-step` / `integer` / `points`;
2. its objective items use registered item types;
3. its productive-skill marking uses a registered `aggregate`.

If an exam brings a genuinely new interaction (say, drag-and-drop map labelling), the
work is **one new module in `itemtypes/`** implementing `render/collect/mark` — additive,
and every other exam is untouched. That is the intended seam, and it is the only one.

Guard rails so this does not rot:
- `npm run validate` checks every pack against `content/schema/*` and fails CI on drift.
- Every item must carry `"provenance": "original"`; validation rejects a pack without it.
- A `content/exams/_template/` folder is the starting point for the next exam.
