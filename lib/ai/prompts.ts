export const QUESTION_EXTRACTION_PROMPT = `You are extracting printed examination questions from a question paper.

Rules:
1. Never invent a question. Extract only questions that are visibly printed.
2. Preserve original printed order.
3. Preserve original numbering exactly as printed in "number".
4. Treat every labelled sub-part as an independent question. Example: 13(a) and 13(b) are two questions.
5. Do not merge separate labelled subparts.
6. Ignore headers, student info fields, and section titles as questions. Do read section notes and mark schemes such as 5 × 4 = 20.
7. Copy question wording as accurately as possible. Do not rewrite.
8. If marks are printed beside a question (e.g. [5 Marks], (3m)), extract that as maxMarks.
   Section schemes such as 5 × 4 = 20, 5x4=20, or 3 × 10 = 30 mean each question IN THAT SECTION has maxMarks equal to the per-question value (4, 10, etc.), not the section total (20, 30). Apply that value to every numbered question in the section. Never use the section total as a single question's maxMarks. Never invent marks that are not printed as a per-question value or as this kind of section formula.
9. Internal choice notes such as "Answer any 5 questions" do not change extraction: still extract every numbered question. Unanswered optional questions are left unanswered later.
10. If the header prints M.M. / Maximum Marks (e.g. 80), copy that exact number as paperMaxMarks. Never invent it. Never use the sum of every listed question when a printed paper maximum exists.
11. For each section with "Answer any N" and a formula such as 5 × 4 = 20, emit a sections entry: attemptAny=5, marksPerQuestion=4, sectionTotal=20, and the question numbers in that section. The paper total is the printed M.M. or the sum of section totals (20+30+30=80), not 7×4+4×10+3×15.
12. page is 1-based.
13. confidence is 0 to 1. If numbering or wording is ambiguous, lower confidence and set ambiguous=true with reviewReason.
14. Return JSON only.

JSON shape:
{
  "paperMaxMarks": 80,
  "sections": [
    {
      "label": "A",
      "attemptAny": 5,
      "marksPerQuestion": 4,
      "sectionTotal": 20,
      "questionNumbers": ["1", "2", "3", "4", "5", "6", "7"]
    }
  ],
  "questions": [
    {
      "number": "13(a)",
      "text": "Explain classification.",
      "page": 1,
      "maxMarks": 5,
      "confidence": 0.96,
      "ambiguous": false
    }
  ],
  "warnings": []
}`;

export const ANSWER_EXTRACTION_PROMPT = `You are extracting handwritten student answers from an answer sheet.

Rules:
1. Never invent answer content. If handwriting is unreadable, set text to a short note that it is unreadable, unreadable=true, and confidence below 0.55.
2. Segment answers logically. Do not assume one page equals one answer.
3. If the student wrote a question number (Q2, 11(a), Ans: 5, a number in the left margin, etc.), put it in questionReference using the printed number. If none is visible, questionReference must be null. Never guess a missing number.
4. Capture EVERY distinct answer. Students may copy the printed question first, then write the answer on the following lines. Extract only the student's answer wording — do not treat the recopied question as the answer. Each answer block is its own region. Coordinates MUST be normalized 0-1 fractions of that page, origin top-left. The box MUST include the question number label AND the answer lines, not leftover blank lines after the answer.
5. The top of each box must be the line that contains that answer's "Ans. N" / "Q N" label — never the last line of the previous answer. Answers may appear out of numerical order. If two answers are on consecutive lines, box them with no extra gap. If there are unused lines between answers, leave those lines outside both boxes.
6. Do not invent coordinates. If a region cannot be located reliably, omit it or set reliable=false. Never highlight the whole page unless the answer truly fills the page. Never skip an answer that has a visible "Ans." or "Q" label. Never return a box that covers two different answers.
7. Multi-page continuations are separate region entries on the same answer, or a following answer with continuedFromPrevious=true and the same questionReference.
8. Preserve student wording. Do not polish or complete the answer.
9. page is 1-based.
10. Return JSON only.

JSON shape:
{
  "answers": [
    {
      "questionReference": "2",
      "text": "Photosynthesis occurs in chloroplasts...",
      "regions": [
        {
          "page": 1,
          "normalizedX": 0.08,
          "normalizedY": 0.22,
          "normalizedWidth": 0.84,
          "normalizedHeight": 0.28,
          "reliable": true
        }
      ],
      "confidence": 0.91,
      "unreadable": false,
      "continuedFromPrevious": false
    }
  ],
  "warnings": []
}`;

export const SEMANTIC_MAPPING_PROMPT = `You map leftover handwritten answers to leftover exam questions.

Rules:
1. Only use the provided questions and answers. Never invent either.
2. Map an answer only when the content clearly addresses that question.
3. Never map one answer to multiple questions.
4. Never map multiple leftover answers to the same question unless they are clearly a continuation of the same response.
5. If unsure, omit the match. Prefer unanswered/unmapped over a guess.
6. confidence is 0 to 1.
7. Return JSON only.

JSON shape:
{
  "matches": [
    {
      "questionNumber": "3",
      "answerIndex": 0,
      "confidence": 0.86,
      "reason": "Answer describes stomata gas exchange."
    }
  ],
  "unmatchedAnswerIndexes": [1],
  "warnings": []
}`;

export const GRADING_PROMPT = `You are assisting a teacher with optional grading of mapped answers.

Rules:
1. Grade only the provided question-answer pairs.
2. If maxMarks is null, score must be null, correctness "unavailable", and feedback may still be given.
3. Never invent maximum marks. Use only the provided maxMarks.
4. Award marks according to the written content versus that maximum:
   - Full marks ONLY if the answer actually covers what a full-mark response needs (enough points, explanation, or working for that mark value).
   - If the question is worth 5 marks and the writing is close but missing a point, too brief, or incomplete, award 4 or less — never 5.
   - A one-line keyword or half-complete explanation on a 4–5 mark question must not receive full marks.
   - Short factual answers on 1–2 mark questions may still receive full marks if the required fact is present and correct.
   - Use whole numbers. Partial credit should reflect how much of the expected content is present.
5. correctness must be "correct" only when score equals maxMarks, "partial" when some marks are earned but not all, and "incorrect" when score is 0.
6. Be conservative. If handwriting is unclear, lower confidence, set reviewRequired=true, and do not award a high score by guessing.
7. Feedback must be short, specific, and based only on the student text. If marks were reduced, say what was missing.
8. This is AI-assisted, not an official mark. Do not claim certainty.
9. The "summary" is only about the mapped answers you graded. Never say the student scored 100% or completed the paper if you were not given every question. Unanswered questions are scored 0 in the app.
9. Return JSON only.

JSON shape:
{
  "grades": [
    {
      "questionNumber": "1",
      "score": 2,
      "maxMarks": 2,
      "correctness": "correct",
      "feedback": "Correctly identifies arteries.",
      "confidence": 0.9,
      "reviewRequired": false
    }
  ],
  "summary": "Short overall comment for the teacher.",
  "warnings": []
}`;
