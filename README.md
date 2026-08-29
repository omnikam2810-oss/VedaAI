# VedaAI

A Next.js app that maps a **printed question paper** to a **handwritten answer sheet**.

Upload two files. The app extracts questions, extracts answers, pairs them, and highlights the selected answer on the script. Nothing is stored after the session ends. There is no login and no database.

## What you can do

1. Open `/` and upload a question paper and an answer sheet (PDF, PNG, JPG, or JPEG; max 10MB and 30 pages each).
2. Click **Start Mapping →**. Progress is streamed step by step (not a blank spinner).
3. On `/assessment`, pick a question on the left. The viewer on the right jumps to that answer and draws a **green box on that answer only**.
4. Weak matches can be confirmed, remapped, or marked unanswered. Unmapped writing is listed separately.
5. Scores appear only when printed marks were extracted **and** the grading step succeeded.

Without a Gemini key, or to skip quota, use **Preview with development demo data**. That loads canned results plus `/demo/*.pdf`. It is not a live extraction.

## Screens

| Route | What it is |
| --- | --- |
| `/` | Upload both files, start mapping, or load demo |
| `/` while processing | “Extracting...” plus the pipeline steps |
| `/assessment` | Question list + answer-sheet viewer. Phone uses Questions / Answer Sheet tabs |

The chrome (Home, Exams, Assignments, Library, Settings, teacher name) is layout only. **Home** and **Exams** go to upload. **Assignments** opens `/assessment`. **My Library** runs demo. **My Classroom** and **Settings** open in-app notices, not separate products.

## How a live run works

```text
Validate files (type, size, magic bytes)
→ Preprocess (page count, EXIF rotate; optional image enhance for AI only)
→ Gemini: questions (printed order, sub-parts like 7(a)/7(b))
→ Gemini: handwritten answers (text, optional Q-number, page, 0–1 boxes)
→ Map by explicit numbers, then Gemini semantics for leftovers
→ Zod + coverage checks (every question gets a row)
→ Optional Gemini grading (skipped if that call fails)
```

The original file is what you see in the viewer. AI may get a processed copy.

Mapping statuses: `mapped`, `review_required`, `conflict`, `unanswered`. Leftover answers: `unmatched`. Question order stays as printed even if the student answered out of order.

A highlight is drawn only if the box is usable (not missing, tiny, off-page, or the whole page). Multi-page answers have previous/next region. Unanswered questions do not highlight.

## AI

- Server-only `GEMINI_API_KEY`. Never sent to the browser.
- Default: `gemini-3.6-flash`. Fallback: `gemini-flash-latest`. Override with `GEMINI_MODEL`.
- Retired IDs such as `gemini-2.5-flash` and `gemini-2.0-flash` are skipped (404 / quota on current keys).
- Gemini is used for question extraction, answer extraction, leftover semantic mapping, and grading.
- Numbering regex, coordinate clipping, duplicate detection, and UI state are not Gemini.

If Gemini is rate-limited, missing, or the model is unavailable, the UI says so and offers retry or demo. Malformed JSON is rejected (Zod), retried once, then failed. Semantic mapping or grading can fail while extraction + explicit mapping still complete.

## Demo dataset

Nine questions. Q4 unanswered. One unmatched block. Q2 spans two pages. `7(b)` is `review_required`. The first extracted answer is labelled as Q5 (out of order). Demo PDFs use italic print, not real handwriting.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Gemini (`@google/genai`), Zod, react-pdf / PDF.js, pdf-lib, sharp, Vitest.

`POST /api/assessment/process` returns an NDJSON stream. State lives in the browser (object URLs) for that session. Refresh without files clears a live run.

## Limits (actual)

- One question paper and one script per run.
- Handwriting and boxes come from the vision model. Uncertain items stay `review_required`; bad boxes are not invented.
- Section formulas like `5 × 4 = 20` are treated as **per-question** marks when the model follows the prompt, not as one 20-mark item.
- Uploads go to Google Gemini for that request. Do not use real student PII on a shared demo.
- Logs do not include answer text.
- Vercel Hobby caps this route at **60s** (`vercel.json`). A live 10-question run can take longer than that locally. Demo finishes in a few seconds.

## Setup

```bash
npm install
cp .env.example .env.local
# set GEMINI_API_KEY (optional if you only use demo)
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

## Deploy

Import the GitHub repo in Vercel. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the project environment. Demo works without a key. Live uploads need a valid key and enough Gemini quota.

```bash
npm run build
npx vercel --prod
```

## Tests

```bash
npm test
```

Covers mapping (order, out-of-order, sub-parts, unanswered, unmatched, duplicates), coordinates, file sniffing, error mapping, Zod rejection, grading caps, and the demo dataset.
