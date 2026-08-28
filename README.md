# VedaAI

Teacher tool for exam papers: upload a **question paper** and a **student answer sheet**, extract questions, map each answer to a question, and highlight the answer region on the page.

This is a Next.js web app for the VedaAI hiring assignment. It is not a full school platform (no login, no database, no class roster).

## What it does

1. Upload a question paper and an answer sheet (PDF, PNG, JPG, or JPEG, max 10MB / 30 pages).
2. Gemini reads the documents on the server.
3. Questions are listed in printed order, including labelled parts such as `7(a)` and `7(b)`.
4. Answers are mapped by written question numbers first, then by meaning if a number is missing.
5. Clicking a question opens the matching page and draws a box on that answer (not the whole page).
6. Unanswered questions, unmapped text, low-confidence items, and mapping conflicts are shown for teacher review.

Optional scores appear only when the paper printed marks and grading succeeded. If marks are unknown, the UI shows **Score unavailable**. The app does not invent marks or answer text.

## How processing works

Live upload (`POST /api/assessment/process`):

```text
Validate files → preprocess → extract questions → extract answers
→ map (explicit numbers, then semantic leftovers) → validate → optional grading
```

Progress is streamed as NDJSON. Files stay in memory for that session. Refreshing the browser clears the assessment.

**Demo mode** (`Preview with development demo data`) uses a fixed Class 10 Science dataset and generated PDFs. It does not call Gemini. It is labelled in the UI as demo data. The demo script uses italic print, not real handwriting.

## Mapping and highlighting

- Question list order never follows the student’s writing order.
- Statuses: `mapped`, `unanswered`, `review_required`, `conflict`. Leftover answers are `unmatched`.
- Highlight boxes are normalized 0–1 coordinates. Tiny, full-page, or invalid boxes are not drawn.
- Multi-page answers use **Previous region / Next region**.
- Confidence below 0.8 is marked for review. Unreadable handwriting is not completed by the model.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- Google Gemini API (`gemini-3.6-flash`, fallback `gemini-flash-latest`)
- react-pdf / PDF.js, pdf-lib, sharp
- Zod for AI JSON validation
- Vitest for mapping, files, coordinates, and demo cases

The API key is server-side only (`GEMINI_API_KEY`). It is never sent to the browser.

## Run locally

```bash
npm install
cp .env.example .env
```

Put a Gemini API key in `.env` (or `.env.local`):

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
```

```bash
npm run demo:pdfs
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Live extraction:** upload both files → **Start Mapping →** (needs a valid key)
- **Demo:** **Preview with development demo data** (no Gemini quota)

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Limits

- One question paper and one answer sheet per run
- Handwriting accuracy depends on Gemini and scan quality; unclear writing goes to review
- Highlight alignment depends on the model’s boxes
- No persistence; session only
- Do not commit `.env` / `.env.local`. Do not upload real student personal data to shared demos
