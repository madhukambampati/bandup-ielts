# Exam formats: what we must mirror

Checked against official sources on 2026-11-19. Every format below changes
periodically — re-verify before each content release. Sources are listed per exam.

> **Why this document exists:** BandUp marks answers on each exam's own scale. If our
> format or scale is out of date, the score we show is wrong even when the AI marking is
> good. This file is the single source of truth that `content/exams/<id>/exam.json`
> is built from.

---

## 1. The headline finding: TOEFL iBT changed in January 2026

**The 0–30 per-section scale is retired.** As of **21 January 2026**:

- Four section scores **and** the overall score are on a **1–6 scale in half-point steps**.
- Overall = **mean of the four sections, rounded to the nearest half band**
  (ETS example: average 5.25 → overall 5.5).
- For a **two-year transition period** test takers *also* get a comparable
  **0–120 overall** figure (the midpoint of the matching total range). Per-section 0–30
  scores are **not** reported any more.
- Total testing time is now about **90 minutes** and the test is **adaptive**
  (ETS: "As the test adapts, test time and items may vary").
- Task types were almost entirely replaced. Only *Write for an Academic Discussion*
  survives from the previous Writing section.

Source: <https://www.ets.org/toefl/test-takers/ibt/about/content.html> and
<https://www.ets.org/toefl/test-takers/ibt/scores/understand-scores.html>

This means **a TOEFL pack built to the 0–30 scale would be wrong on day one.**

---

## 2. Side-by-side comparison

| | **IELTS Academic / General Training** | **CELPIP-General** | **PTE Academic** | **TOEFL iBT** |
|---|---|---|---|---|
| **Scale** | Band **0–9**, whole + half bands | Level **0–12** (integers; 0 and 1 = "insufficient information to assess") | **10–90** points on the Global Scale of English | **1–6**, half-point steps |
| **Overall score** | Mean of 4 sections, rounded to nearest half band | **None reported** — four separate levels | **Not an average** of the four skills (Pearson states this explicitly) | Mean of 4 sections, rounded to nearest half band (+ 0–120 comparable until ~2028) |
| **Total time** | 2 h 45 min | ~2 h 40 min | ~2 h | ~90 min (adaptive) |
| **Marked by** | Human examiners (Writing, Speaking) | Trained human raters (Writing, Speaking) | **AI**, with human review of some traits | Centralised ETS scoring team |
| **Listening** | ~30 min, 4 parts, **40 questions**, heard **once** (+10 min transfer on paper) | **46–55 min**, 6 parts | **31–39 min**, 8 question types | **29 min**, 47 items, 4 task types |
| **Reading** | 60 min, 40 questions. *Academic:* 3 sections, 2150–2750 words. *GT:* 3 sections from 5–6 short everyday texts | **43–56 min**, 4 parts | **23–30 min**, 5 question types | **~30 min**, 50 items, 3 task types |
| **Writing** | 60 min, 2 tasks. *Academic:* T1 chart/graph report (150 w, 20 min) + T2 essay (250 w, 40 min). *GT:* T1 **letter** (150 w) + T2 essay (250 w) | **53 min**, 2 tasks: Email, Responding to Survey Questions | Inside Part 1 (76–84 min): Summarize Written Text (1 sentence, 10 min), Write Essay (200–300 w, 20 min) | **23 min**, 12 items: Build a Sentence, Write an Email, Write for an Academic Discussion |
| **Speaking** | 11–14 min, 3 parts (interview / 2-min long turn with 1 min prep / discussion) | **15 min**, **8 tasks** | Inside Part 1, 7 spoken task types | **8 min**, 11 items: Listen and Repeat, Take an Interview |
| **Marking criteria** (productive skills) | Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy (**+ Pronunciation** in Speaking) | Content/Coherence, Vocabulary, **Readability** (Writing) / **Listenability** (Speaking), Task Fulfillment | Per-task traits (content, form, grammar, vocabulary, spelling, oral fluency, pronunciation…) rolled into 10–90 | ETS rubrics per task; reported as 1–6 |
| **Notable scoring quirk** | **Writing Task 2 counts twice as much as Task 1.** Academic and GT Reading use **different** raw→band tables (GT needs more correct answers for the same band) | Raters award a **holistic** level per skill, not a mean of the four dimensions | Three item types use **negative marking** (MC-multiple-answers in Reading and Listening, Highlight Incorrect Words) | Adaptive; section scores map to the old 0–30 ranges via a published concordance |

Sources: ielts.org test-type and band-score pages, takeielts.britishcouncil.org,
ielts.com.au/results/band-score-calculation; celpip.ca/test-format-scoring and the
CELPIP Performance Standards PDFs; pearsonpte.com test-format (3 sub-pages) and
/pte-academic/scoring; ets.org TOEFL content + understand-scores.

---

## 3. Per-exam task inventory (what content packs must contain)

### IELTS (Academic + General Training)
Listening and Speaking are **identical** across the two; Reading and Writing differ.

- **Listening** — 4 parts × 10 questions. Parts 1–2 everyday/social (P1 conversation,
  P2 monologue), Parts 3–4 educational (P3 conversation, P4 academic monologue).
  Mixed accents. Heard once.
- **Reading (Academic)** — 3 long passages, increasingly difficult.
- **Reading (GT)** — Section 1 social survival (2–3 short texts), Section 2 workplace,
  Section 3 one longer general-interest text.
- **Writing (Academic)** — T1 describe visual data; T2 discursive essay.
- **Writing (GT)** — T1 letter (personal / semi-formal / formal, 3 bullet points given,
  no addresses needed); T2 discursive essay.
- **Speaking** — P1 intro + familiar topics (4–5 min); P2 cue card, 1 min prep,
  up to 2 min talk (3–4 min total); P3 abstract discussion (4–5 min).

Question types to support: gap-fill / sentence completion, True-False-Not Given,
Yes-No-Not Given, matching headings, matching information, multiple choice (single
and multiple), diagram/map/plan labelling, short answer, summary completion.

### CELPIP-General
- **Listening** (6 parts): Problem Solving · Daily Life Conversation · For Information ·
  News Item · Discussion · Viewpoints.
- **Reading** (4 parts): Correspondence · To Apply a Diagram · For Information · For Viewpoints.
- **Writing** (2 tasks): Writing an Email · Responding to Survey Questions.
- **Speaking** (8 tasks): Giving Advice · Talking about a Personal Experience ·
  Describing a Scene · Making Predictions · Comparing and Persuading ·
  Dealing with a Difficult Situation · Expressing Opinions · Describing an Unusual Situation.

Note: Listening and Reading contain **unscored trial items** indistinguishable from
scored ones. Also **CELPIP-LS** is a separate shorter test (Listening + Speaking only) —
a candidate for a cheap extra pack later.

### PTE Academic — 22 scored question types in 3 parts
**Part 1 · Speaking & Writing (76–84 min), 9 types** (plus an unscored Personal Introduction):
Read Aloud (text ≤60 w) · Repeat Sentence (3–9 s audio, 15 s to answer) ·
Describe Image (25 s prep, 40 s) · Retell Lecture (≤90 s audio, 10 s prep, 40 s) ·
Answer Short Question (10 s) · Summarize Group Discussion (3 speakers, ≤3 min audio, 2 min) ·
Respond to a Situation (prompt ≤60 w, 40 s) · Summarize Written Text
(text ≤300 w → **one sentence**, 10 min) · Write Essay (200–300 w, 20 min).

**Part 2 · Reading (23–30 min), 5 types:** Fill in the Blanks (Dropdown, ≤200 w,
*also scores writing*) · Multiple Choice Multiple Answers (≤350 w, **negative marking**) ·
Reorder Paragraph (≤110 w) · Fill in the Blanks (Drag and Drop, ≤80 w) ·
Multiple Choice Single Answer (≤110 w).

**Part 3 · Listening (31–39 min), 8 types:** Summarize Spoken Text (60–90 s audio →
50–70 w, 10 min; <40 or >100 words scores **zero**) · Multiple Choice Multiple Answers
(**negative marking**) · Fill in the Blanks (Type In) · Highlight Correct Summary ·
Multiple Choice Single Answer · Select Missing Word · Highlight Incorrect Words
(**negative marking**) · Write from Dictation.

Reported as four communicative skills (10–90) plus a **Skills Profile** of eight groups.
The old six "enabling skills" (grammar, oral fluency, pronunciation, spelling, vocabulary,
written discourse) were **removed from score reports in November 2021** — do not show them.

### TOEFL iBT (current, post-Jan 2026)
- **Reading** — 50 items, ~30 min: Complete the Words · Read in Daily Life ·
  Read an Academic Passage.
- **Listening** — 47 items, 29 min: Listen and Choose a Response · Listen to a
  Conversation · Listen to an Announcement · Listen to an Academic Talk.
- **Writing** — 12 items, 23 min: Build a Sentence · Write an Email ·
  Write for an Academic Discussion.
- **Speaking** — 11 items, 8 min: Listen and Repeat · Take an Interview.

---

## 4. What this forces into the design

1. **Scales are not interchangeable.** Four different kinds: half-band (IELTS, TOEFL),
   integer level (CELPIP), raw points (PTE). Scale behaviour must be data, not `if` branches.
2. **"Overall score" is not universal.** CELPIP publishes none; PTE's is explicitly not an
   average. Inventing one would be dishonest — see decision D4 in `roadmap.md`.
3. **Criterion aggregation differs.** IELTS = mean of 4 criteria (and Writing T2 weighted 2×);
   CELPIP = holistic; PTE = trait partial-credit; TOEFL = per-task rubric → band.
4. **Academic vs GT Reading need separate raw→band tables.** v1 has a single `REA_T`,
   which is wrong for General Training.
5. **Negative marking exists in PTE.** The objective marker needs a per-item-type
   scoring policy, not a global "1 mark per correct answer".
6. **Some tasks cannot be marked from text at all.** PTE *Read Aloud* / *Repeat Sentence*
   and TOEFL *Listen and Repeat* are fundamentally pronunciation and fluency tasks.
   Speech-to-text gives us words, not delivery — see decision D2 in `roadmap.md`.
