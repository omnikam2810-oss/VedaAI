# VedaAI

Teacher tool for one exam script: upload a **printed question paper** and a **handwritten answer sheet**, then see which questions were answered, where each answer sits on the page, and which questions were left blank.

This is a Next.js web app. There is no login, no database, and no class roster. Files stay in memory for the current session.

**Try it without an API key:** open the app → **Preview with development demo data**.

---

## What the app does

| Step | What you see |
| --- | --- |
| `/` | Upload a question paper and an answer sheet (PDF, PNG, JPG, JPEG · 10MB · 30 pages). **Start Mapping →** when both files are attached. |
| Processing | Named steps (upload, extract questions, extract answers, map, analyse) — not a blank spinner. |
| `/assessment` | Questions on the left in **printed order**. The answer sheet on the right. Click a question to jump to that answer and draw a **green box on that answer only**. Phone: Questions / Answer Sheet tabs. |

You can also:

- Confirm, remap, or mark unanswered when a match is weak
- Inspect leftover writing that did not map to any question
- See marks obtained / paper total when printed marks were read and grading ran
- Start a new assessment from the results screen

Sidebar labels (Home, Exams, Assignments, Library, Classroom, Settings) are chrome. **Home** and **Exams** go to upload. **Assignments** opens `/assessment`. **My Library** loads demo. Classroom and Settings are notices, not extra products.

---

## How to review (recommended)

1. Run locally or open the deployed URL.
2. Click **Preview with development demo data** (or `/?demo=1`).
3. Open questions on the left. Check:
   - **Q4** unanswered (no highlight)
   - **Q2** spans two pages (Previous / Next region)
   - **7(b)** review required
   - First student answer is labelled **Q5** (out of order; list stays 1…n)
   - One **unmapped** block
4. Optional: upload your own two files and **Start Mapping →** (needs `GEMINI_API_KEY`).

Demo PDFs use italic print, not real handwriting. The banner says so.

---

## Live pipeline

```text
Validate files (type, size, magic bytes)
→ Preprocess (page count, EXIF rotate; optional enhance for AI only)
→ Gemini: questions in printed order, including 7(a) / 7(b)
→ Gemini: handwritten answers (text, optional Q-number, page, 0–1 boxes)
→ Map by written numbers first, then meaning for leftovers
→ Zod + coverage (every question gets a row)
→ Optional Gemini grading (skipped if that call fails)
```

`POST /api/assessment/process` streams NDJSON progress. The viewer shows the **original** file. AI may receive a processed copy.

**Statuses:** `mapped` · `review_required` · `conflict` · `unanswered`. Leftover answers: `unmatched`.

**Highlights:** normalized 0–1 boxes. Missing, tiny, off-page, or full-page boxes are not drawn. Unanswered questions do not highlight.

---

## Mapping and marks (actual rules)

- Question list order never follows the student’s writing order.
- The model must not invent question text, answer text, or marks. Uncertain items stay `review_required`.
- Per-question marks come from the paper (`[4 Marks]`, or `5 × 4 = 20` → **4** per question in that section, not 20).
- **Internal choice** (e.g. “Answer any 5” and header **M.M. 80**): every listed question is still extracted. The **paper total** is the printed maximum (80), not the sum of every optional item (that would be 113 on a 7+4+3 paper). Extra unused options are not added to the total. If a student answers more than required in a section, only the allowed number of attempts count.
- Overall **marks obtained / total marks** includes unanswered **required** work as 0 when a printed paper or section total exists. Without a printed maximum or choice scheme, unanswered questions with known marks still count as 0 in that sum.
- Scores are AI-assisted. The UI says teacher review is recommended.

---

## AI

| | |
| --- | --- |
| Provider | Google Gemini (server-only `GEMINI_API_KEY`) |
| Default | `gemini-3.6-flash` · fallback `gemini-flash-latest` · override `GEMINI_MODEL` |
| Used for | Questions, handwritten answers, leftover semantic mapping, optional grading |
| Not used for | Number regex, box clipping, duplicate detection, UI state |

Retired model IDs (`gemini-2.5-flash`, `gemini-2.0-flash`, …) are skipped. Quota, missing key, or a bad model show a clear error plus **Retry** / **Use demo dataset**. Zod rejects malformed JSON. Semantic mapping or grading can fail while extraction and number-based mapping still finish.

Free Gemini tiers are small (often ~5 requests/minute and ~20/day per model). Demo uses **no** Gemini.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · `@google/genai` · Zod · react-pdf / PDF.js · pdf-lib · sharp · Vitest

---

## Run locally

```bash
npm install
cp .env.example .env.local
# add GEMINI_API_KEY only if you will upload real papers
npm run demo:pdfs
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
# GEMINI_TIMEOUT_MS=45000
```

Never commit `.env` or `.env.local`.

---

## Deploy

Import this repo in [Vercel](https://vercel.com). Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) on the project. Demo works without a key.

```bash
npm run build
npx vercel --prod
```

Hobby functions on this route are capped at **60 seconds** (`vercel.json`). A live multi-page Gemini run can take longer locally. Demo finishes in a few seconds.

---

## Tests

```bash
npm test
```

Coverage includes ordered and out-of-order mapping, sub-parts, unanswered / unmatched, internal-choice paper totals (80 not 113), highlight layout, file sniffing, error mapping, Zod rejection, grading caps, and the demo dataset.

---

## What this is not

- Not a school platform (no login, no saved classes, no history after refresh)
- Not official board marks — assistive only
- Handwriting and boxes depend on scan quality and Gemini
- Do not upload real student personal data to a shared demo; uploads are sent to Google for that request only. Answer text is not logged.
