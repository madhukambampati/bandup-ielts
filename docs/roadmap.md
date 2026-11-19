# Roadmap: BandUp IELTS → BandUp (multi-exam)

Branch: `claude/multi-exam-platform`. `main` keeps working v1 IELTS throughout.
Constraints held at every step: **free**, **Vercel**, **prompts server-side**,
**original content only**, **no past papers**.

---

## Decisions (settled 2026-11-19)

| # | Decision | Chosen |
|---|---|---|
| **D1** | TOEFL scale | **1–6 in half-point steps, with the comparable 0–120 total shown beside it.** The 0–30 per-section scale was retired on 21 January 2026, so marking on it would not match any current score report. The 0–120 figure keeps students' scores usable at universities that have not updated their requirement pages. |
| **D2** | Pure-pronunciation tasks (PTE *Read Aloud*, *Repeat Sentence*; TOEFL *Listen and Repeat*) | **Unscored practice, stated on screen.** Show the target, let the student record and self-compare, and say plainly it is not scored. Only text reaches the examiner, so a score would mostly measure speech-to-text accuracy. This extends v1's existing honesty about pronunciation. |
| **D3** | Overall score where the exam publishes none (CELPIP, PTE) | **Four skill scores only; a clearly-labelled "BandUp estimate" behind a toggle.** Never presented as the exam's own overall. Enforced in code: `hasOfficialOverall()` returns false for those scales, and `validate.mjs` rejects any pack declaring `trait-estimate` as its official overall. |
| **D4** | Build order | **Engine + IELTS first, then CELPIP, PTE, TOEFL.** Migrates what already works, proves the pack model on General Training (mostly a data diff), and keeps the site shippable at every phase. |

---

## What "done" means

Anyone arrives, picks their exam, and can either **drill one module** or **sit a full
timed test** that behaves like the real thing and ends with a real score report. Free,
no account needed. For every exam: all four modules, several practice papers, module
tips, and AI marking of Writing and Speaking.

| Requirement | Where it is met |
|---|---|
| All four modules for every exam | `sections` in each `exam.json`; one item set per module per form |
| Scores at the end, like a real exam | Exam mode + `report.js` (Phase 2) |
| Practise like the real exam | Real clocks, audio once, hints off, no feedback until the end |
| Several practice papers | `forms/test-01.json`, `test-02`, `test-03` per exam |
| Tips per module | `tips/<skill>.json` per exam, written per level |
| AI marking of Writing **and** Speaking | `api/ai.js`, one call per skill |
| Listening and Reading | Objective marking in the browser: instant, unlimited, free. AI explains wrong answers on request rather than scoring them |
| Free | Objective modules cost nothing; one daily AI limit per visitor across all exams |

---

## Phase 0 — Groundwork ✅ done
1. ✅ Split `public/index.html` into `index.html` + `app.js` + `styles.css`, verified in a browser.
2. ✅ `schema/`, `scripts/validate.mjs`, `test/` with `npm test`.
3. ✅ `public/engine/scale.js` — scales as data, tested against the boards' worked examples.
4. ✅ `ielts-academic` and `ielts-general` packs (identity + scale), with the separate
   General Training Reading table that v1 was missing.

## Phase 1 — Engine, and IELTS Academic as real data
5. Move every IELTS item out of `app.js` and `api/_content.js` into
   `public/content/exams/ielts-academic/items/`. **Delete the duplication.**
6. `registry.js` (load packs, resolve `sharesItemsWith`), `marker.js`, and `itemtypes/`
   for what v1 already uses: `gap-fill`, `tfng`, `mcq-single`.
7. Rewrite `api/ai.js` to `{ examId, mode, itemId|formId, answer, level }`, assembling
   prompts from `_prompt.js` + `_personas.js` + rubric data. Prompts stay server-side.
8. Make the result renderer rubric-driven — no hardcoded `ta`/`cc`/`lr`/`gra`.
9. `tips/*.json` for the four IELTS modules; the Learn page renders from the files.

**Ships:** v1's features, now data-driven, with per-module tips. Regression-tested against `main`.

## Phase 2 — Exam mode, score report, exam picker, General Training
10. `session.js`: practice vs exam mode — real clocks, audio once, hints off,
    no feedback until the end, no returning to a finished section.
11. `report.js`: one score report from a finished form — four section scores, the exam's
    own overall rounding shown explicitly, per-criterion rows for Writing and Speaking.
12. `forms/test-01.json` for IELTS Academic; full-test flow end to end.
13. Exam picker: landing → choose exam → drill a module or sit a full test.
    Hash routes become `#/ielts-academic/writing`. Migrate `bandup.v1` → `bandup.v2`
    (existing scores filed under `ielts-academic`).
14. Ship `ielts-general`: Listening and Speaking shared from Academic, plus GT Reading
    (5–6 short texts) and GT Writing Task 1 letters.

**Ships:** the headline feature — a real timed IELTS test with a score report — on two exams.

## Phase 3 — Practice papers for IELTS
15. Forms 2 and 3 for both IELTS exams: new original Listening, Reading, Writing and
    Speaking sets, topic-varied, with a difficulty ladder across levels.

**Ships:** three full papers per IELTS exam. This is the first point the site is genuinely
useful to someone preparing seriously.

## Phase 4 — CELPIP-General
16. New item type: `apply-a-diagram`. New aggregate: `holistic`.
17. Content: 6 Listening parts, 4 Reading parts, 2 Writing tasks, 8 Speaking tasks, tips, 1 form.
18. Rubrics: Content/Coherence · Vocabulary · Readability/Listenability · Task Fulfillment.
19. Per D3: four levels 0–12, no invented overall.

## Phase 5 — PTE Academic
20. New item types: `reorder-paragraph`, `dropdown-fill`, `drag-fill`,
    `highlight-incorrect-words`, `select-missing-word`, `dictation`.
21. Marker gains `penaliseWrong` and `form-gate` (the 40–100 word zero rule).
22. Per D2, *Read Aloud* and *Repeat Sentence* ship as unscored practice.
23. Honest limits: our 10–90 is an estimate; Pearson's own overall is not an average.

## Phase 6 — TOEFL iBT (current format)
24. New item types: `complete-the-words`, `build-sentence`, `listen-and-choose-response`.
25. Scale 1–6 half-steps plus the comparable 0–120 total (D1).
26. Tasks: Read in Daily Life · Read an Academic Passage · the four Listening types ·
    Write an Email · Write for an Academic Discussion · Take an Interview.
    *Listen and Repeat* per D2.
27. Say on screen that the real test is adaptive and ours is fixed-form.

## Phase 7 — Learning layer
28. Level-based paths per exam (beginner → professional), anchored to that exam's scale.
29. Exam-aware study plan and tutor.
30. AI coaching on wrong Listening/Reading answers: where the answer was hiding, and the
    pattern across a student's mistakes.
31. Cross-exam view using **published** concordances only (Pearson's PTE↔IELTS table,
    ETS's 1–6↔0–120 table, CELPIP↔CLB↔CEFR), each labelled with its source.

## Phase 8 — Scale-up and polish
32. More forms per exam; topic variety; difficulty ladder per level band.
33. README rewrite, trademark notices for all four exam owners, cost guide update.

---

## Cost and the "stays free" promise

Full timed tests across five exam packs multiply **content**, not necessarily spend.

- **Listening and Reading cost nothing.** They are marked in the browser against the
  answer key: instant, unlimited, and correct every time. This is most of what a student
  does, and it stays free forever.
- **A full test costs two AI calls**, not one per task: the whole Writing script in one
  request, the whole Speaking transcript in another. A full IELTS test is therefore two
  Sonnet calls. PTE, with nine productive tasks, is still two.
- **The daily limit stays per visitor per day across all exams**, so the ceiling per
  visitor is unchanged from v1 no matter how many packs exist.
- Tutor and study plans stay on Haiku; marking stays on Sonnet.
- If spend grows: lower `DAILY_LIMIT`, or move short-task marking (PTE's one-sentence
  summary, TOEFL's Build a Sentence) to Haiku — a per-rubric setting, not a code change.

## Risks
- **Formats change.** `docs/exam-formats.md` is dated and sourced; re-verify per release.
  TOEFL's January 2026 overhaul is exactly this risk already having happened once.
- **Content volume is the real cost**, not code. 4 skills × 5 exams of original material is
  the bulk of the work; the engine is the smaller half.
- **Trademarks.** Each exam needs its own non-affiliation notice.
- **Scope creep into audio scoring.** Real pronunciation marking needs an audio model and
  would break the free/server-side-prompt shape. Out of scope unless deliberately chosen.
