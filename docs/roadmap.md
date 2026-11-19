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

## Phase 0 — Groundwork (no behaviour change)
1. Split `public/index.html` into `index.html` + `app.js` + `styles.css`. No logic edits.
2. Add `schema/*.json` and `npm run validate`.
3. Add `public/engine/scale.js` with `half-step` / `integer` / `points` kinds and the
   aggregate functions; unit-test the IELTS rounding rules against the official
   worked examples (6.5/6.5/5.0/7.0 → 6.5; 4.0/4.5/4.0/4.0 → 4.0; 6.5/6.5/5.5/6.0 → 6.0).

**Ships:** identical site, tested scale maths underneath.

## Phase 1 — Extract the engine, IELTS Academic as the first pack
4. Move all IELTS content out of `index.html` and `api/_content.js` into
   `public/content/exams/ielts-academic/`. **Delete the duplication** — both sides now import
   `content/`. This is the single biggest win in the whole project.
5. Build `registry.js`, `marker.js`, `itemtypes/` for the types v1 already uses
   (gap-fill, tfng, mcq-single).
6. Rewrite `api/ai.js` to take `{ examId, mode, itemId, answer, level }` and assemble
   prompts from `_prompt.js` + rubric data. Prompts stay on the server.
7. Make the result renderer rubric-driven (loop `rubric.criteria`, no hardcoded `ta/cc/lr/gra`).

**Ships:** v1 feature set, now data-driven. Regression-test every screen against `main`.

## Phase 2 — Exam picker + IELTS General Training
8. Add the exam-choice layer: landing → pick exam → skills. Hash routes become
   `#/ielts-academic/writing`. `localStorage` migrates `bandup.v1` → `bandup.v2`.
9. Ship `ielts-general`: reuses Listening and Speaking wholesale, adds GT Reading
   (5–6 short texts) and GT Writing Task 1 **letters**, with the **separate GT
   raw→band table** (v1's single `REA_T` is wrong for GT).

**Ships:** two exams, and proof the pack model works — GT is mostly a data diff.

## Phase 3 — CELPIP-General
10. New item types: `apply-a-diagram`. New aggregate: `holistic`.
11. Content: 6 Listening parts, 4 Reading parts, 2 Writing tasks, 8 Speaking tasks.
12. Rubrics with Content/Coherence · Vocabulary · Readability/Listenability · Task Fulfillment.
13. Per D3: four levels 0–12, no invented overall.

**Ships:** first non-IELTS exam, and the first real test of "is this just data?"

## Phase 4 — PTE Academic
14. New item types: `reorder-paragraph`, `dropdown-fill`, `drag-fill`,
    `highlight-incorrect-words`, `select-missing-word`, `dictation`.
15. Marker gains `penaliseWrong` and `form-gate` (the 40–100 word zero rule on
    Summarize Spoken Text).
16. Honest limits page: PTE is AI-marked on traits including oral fluency and
    pronunciation; our 10–90 is an **estimate**, and the pure-pronunciation tasks follow D2.

**Ships:** the hardest pack. Its item types are where most new engine code lands.

## Phase 5 — TOEFL iBT (current format)
17. New item types: `complete-the-words`, `build-sentence`, `listen-and-choose-response`.
18. Scale `1–6` half-steps + the 0–120 comparable table (per D1).
19. Tasks: Read in Daily Life · Read an Academic Passage · the four Listening types ·
    Write an Email · Write for an Academic Discussion · Take an Interview.
    *Listen and Repeat* per D2.
20. Note on screen that the real test is **adaptive** and ours is fixed-form.

## Phase 6 — Learning layer and polish
21. Level-based learning paths per exam (beginner → professional), each anchored to that
    exam's own scale via `levelMap`.
22. Exam-aware study plan and tutor.
23. Cross-exam dashboard: "your CELPIP 9 is roughly IELTS 7" using **published**
    concordances only (Pearson's PTE↔IELTS table, ETS's 1–6↔0–120 table, CELPIP↔CLB↔CEFR),
    each labelled with its source. No home-made equivalences.
24. README rewrite, trademark notices for all four exam owners, cost guide update.

## Phase 7 — Content scale-up
25. 3–5 full practice sets per exam, all original, each tagged `"provenance": "original"`.
26. Topic variety and a difficulty ladder per level band.

---

## Cost and the "stays free" promise
Five packs multiply **content**, not necessarily spend. Keeping the daily AI limit
per visitor **across all exams** means the ceiling per visitor is unchanged from v1.
Objective skills (Listening, Reading) stay unlimited and cost nothing — they are marked
in the browser. Only Writing, Speaking, plan and tutor hit the API. Tutor and plan stay on
Haiku; marking stays on Sonnet. If spend grows: lower `DAILY_LIMIT`, or move marking of
short tasks (PTE one-sentence summary, TOEFL Build a Sentence) to Haiku, which is a
per-rubric setting rather than a code change.

## Risks
- **Formats change.** `docs/exam-formats.md` is dated and sourced; re-verify per release.
  TOEFL's January 2026 overhaul is exactly this risk already having happened once.
- **Content volume is the real cost**, not code. 4 skills × 5 exams of original material is
  the bulk of the work; the engine is the smaller half.
- **Trademarks.** Each exam needs its own non-affiliation notice.
- **Scope creep into audio scoring.** Real pronunciation marking needs an audio model and
  would break the free/server-side-prompt shape. Out of scope unless deliberately chosen.
