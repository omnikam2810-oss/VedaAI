# VedaAI — Assessment Extraction & Answer Mapping

A production-quality MVP that helps a teacher upload a printed question paper and a handwritten student answer sheet, then see **which question was answered, where the answer is on the page, and which questions were left unanswered**.

This is not a generic dashboard. It is a focused exam-mapping product: extraction, mapping, exact highlighting, and honest uncertainty.

## Problem Statement

Teachers spend hours pairing handwritten scripts with the question paper. Students answer out of order, skip questions, continue across pages, and write unclear numbers. Manual mapping is slow and easy to get wrong. Existing tools often extract text only, with no reliable spatial link back to the script.

## Solution

VedaAI runs a staged pipeline:

```text
Upload
→ Preprocessing
→ Question extraction
→ Handwritten answer extraction
→ Hybrid mapping
→ Validation
→ Spatial highlighting
→ Optional grading / feedback
```

The teacher then works in a two-pane assessment view: extracted questions on the left, the answer sheet on the right. Selecting a question navigates to the mapped region and draws a green overlay on that answer only.

## Features

- Upload question paper and answer sheet (PDF, PNG, JPG, JPEG)
- Meaningful processing progress (never a bare “Loading…”)
- Question extraction that preserves printed order and labelled sub-parts
- Handwritten answer extraction with page + region metadata
- Hybrid mapping: explicit question numbers first, semantic matching second
- Out-of-order answers mapped without reordering the question list
- Unanswered questions and unmapped answers called out explicitly
- Multi-page answer regions with region navigation
- Exact highlight overlay (not a full-page wash)
- Confidence labels and manual review for weak mappings
- Optional AI grading and feedback, never invented marks
- Assessment summary
- Demo mode for UI and mapping review without consuming Gemini quota

## Screenshots

The UI follows the official VedaAI hiring assignment screens:

1. Upload empty state
2. Upload with both files attached and **Start Mapping →** enabled
3. Extracting state with sparkle loader and step-by-step progress
4. Desktop question list + answer sheet with green region highlight
5. Mobile tabs: Questions / Answer Sheet

Run the app locally and capture these same screens from the live product.

## Architecture

```text
Browser (Next.js App Router)
  Upload files (kept in memory / object URLs)
        │
        ▼
POST /api/assessment/process   (NDJSON progress stream)
        │
        ├─ File validation (extension + MIME magic bytes + size)
        ├─ Preprocessing (PDF metadata, image rotate/enhance for AI only)
        ├─ Gemini question extraction (Prompt A)
        ├─ Gemini handwritten answer extraction (Prompt B)
        ├─ Deterministic explicit-number mapping
        ├─ Gemini semantic mapping for leftovers (Prompt C)
        ├─ Zod + business validation
        └─ Optional Gemini grading (Prompt D)
        │
        ▼
Assessment dashboard
  Question list  |  PDF.js / image viewer + highlight overlay
```

Original documents used for rendering are not rewritten. AI may receive an enhanced *copy* of a low-quality image.

Storage is in-memory / session-only. Nothing is persisted to a database.

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Next.js App Router, React, TypeScript | Server routes + polished client workspace |
| Styling | Tailwind CSS | Matches the Figma spacing, pills, and layout quickly |
| Documents | react-pdf / PDF.js, pdf-lib, sharp | Render PDFs, count pages, correct image orientation |
| AI | Google Gemini (`gemini-2.5-flash`) | Strong document/vision JSON extraction at reasonable cost |
| Validation | Zod | Never trust raw model output |
| Tests | Vitest | Mapping, numbering, coordinates, malformed AI, files |
| Deploy | Vercel | Fits the Next.js route-handler architecture |

## AI Model

- **Provider:** Google Gemini API
- **Default model:** `gemini-2.5-flash` (override with `GEMINI_MODEL`)
- **Fallback:** `gemini-2.0-flash` if the primary model is unavailable
- **Why:** Multimodal PDF/image input, structured JSON, low latency for an interactive teacher workflow
- **Used for:** question extraction, handwritten answer extraction, leftover semantic mapping, optional grading
- **Not used for:** numbering regex, page bounds, duplicate detection, coordinate clipping, UI state

The API key is read only on the server from `GEMINI_API_KEY`. It is never sent to the browser.

## Extraction

Question extraction asks Gemini for printed items in order, with original numbering. Labelled sub-parts such as `13(a)` and `13(b)` become two questions. Marks are copied only when printed; otherwise `maxMarks` is `null`.

Answer extraction asks for student text, optional question references, page numbers, and **normalized 0–1 bounding boxes** (top-left origin). Unreadable handwriting is flagged `review_required` instead of being completed by the model.

## Answer Mapping

1. **Explicit number detection** — `Q2`, `11(a)`, `Ans: 7(a)`, and similar forms are normalized and matched.
2. **Semantic matching** — leftover answers are compared to leftover questions. Weak matches are not silently accepted.
3. **Coverage** — every question gets a mapping row: `mapped`, `review_required`, `conflict`, or `unanswered`. Leftover answers become `unmatched`.

Questions always stay in printed order, even if the student answered Q5 first.

## Spatial Highlighting

Regions are stored as normalized fractions plus original page size when known:

```text
Model coordinates
  → normalized 0–1 box
  → reliability check
  → CSS overlay on the rendered page
```

A box is rejected (no fake highlight) if it is missing, tiny, outside the page, or effectively the entire page. Multi-page answers expose **Previous region / Next region**.

## Edge Cases

| Case | Behaviour |
| --- | --- |
| Out-of-order answers | Mapped by number/semantics; question list stays 1…n |
| Unanswered | `unanswered`; click does not highlight |
| Unmapped answer | Listed separately; teacher can inspect its region |
| Multi-page answer | Multiple regions; viewer jumps per region |
| Low confidence | `review_required` with confirm / remap / mark unanswered |
| Poor handwriting | Low confidence or unreadable flag, not invented text |
| Invalid file | Clear error (type, size, magic-byte mismatch, empty) |
| AI failure | Streamed error + retry; demo mode still works |
| Malformed AI JSON | Zod rejects; request retried then failed honestly |
| Duplicate mapping | `conflict` for teacher review |
| Rotated scan | `sharp.rotate()` uses EXIF before AI sees the copy |

## Assumptions

- One question paper and one student script per session
- Papers are at most 10MB and 30 pages
- Gemini can see the uploaded PDF or image; extremely faint scans may need review
- No login or database is required for this MVP
- Demo PDFs approximate handwriting with italic text so highlighting can be demonstrated without quota

## Limitations

- Handwriting recognition is not perfect. The product prefers **review_required** over a confident wrong answer.
- Bounding boxes depend on the vision model. Unreliable boxes are not drawn.
- Optional scores appear only when question marks were extracted and grading succeeded.
- Vercel hobby plans cap serverless duration and body size; large scripts may need a Pro project or local `next start`.
- Documents live in memory for the session only. Refreshing the assessment page without demo files clears the live upload.

## Privacy

Student scripts can contain personal data. This MVP:

- Does not write uploads to a database or public bucket
- Keeps files in memory for the request and in browser object URLs for viewing
- Does not log answer text
- Sends documents to Gemini only for the current processing run

Do not use real student PII in shared demos.

## Local Setup

```bash
npm install
cp .env.example .env.local
# put your Gemini key in .env.local
npm run demo:pdfs
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Upload two files and click **Start Mapping →**
- Or click **Preview with development demo data** to exercise mapping, unanswered Q4, unmapped text, multi-page Q2, and low-confidence 7(b)

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Never commit `.env.local`. `.env.example` has no secrets.

## Deployment

1. Push this repository to GitHub (without `.env.local`).
2. Import the project in Vercel.
3. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in Vercel environment variables.
4. Deploy. Confirm `/` loads, demo mode runs, and a real upload processes if the key is valid.

```bash
npm run build
npx vercel --prod
```

Set the process route `maxDuration` to at least 60 seconds so extraction can finish.

## Tests

```bash
npm test
```

Coverage includes ordered mapping, out-of-order mapping, sub-parts, unanswered, unmatched, multi-page regions, low confidence, invalid files, AI error mapping, Zod rejection, invalid coordinates, duplicate mappings, and demo dataset edge cases.
