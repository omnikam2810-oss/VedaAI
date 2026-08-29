import { describe, expect, it } from "vitest";
import { isReliableRegion, fromNormalizedFractions, expandHighlightRegion, clipHighlightToNeighbors, highlightFromAnswer } from "@/lib/coordinates";
import { marksPerQuestionFromFormula } from "@/lib/extraction/sectionMarks";
import { displayQuestionNumber, extractQuestionReference, normalizeQuestionNumber } from "@/lib/extraction/numbering";
import { validateUpload } from "@/lib/files/validate";
import { applySemanticMatches, explicitMap, mergeContinuedAnswers, unansweredMappings, markUnmatchedAnswers } from "@/lib/mapping/answerMapper";
import { sniffMime } from "@/lib/files/sniff";
import { parseStreamEvent, safeJsonParse } from "@/lib/utils";
import { toAppError } from "@/lib/errors";
import { applyManualMapping, detectDuplicateMappings, finalizeAssessment } from "@/lib/validation/business";
import { scoreFromWrittenContent } from "@/lib/grading/grader";
import { aiQuestionExtractionSchema } from "@/lib/validation/schemas";
import { getDemoAssessment } from "@/lib/demo/dataset";
import type { Answer, Mapping, Question } from "@/types/assessment";

function q(id: string, number: string, text: string): Question {
  return {
    id,
    number,
    displayNumber: displayQuestionNumber(number),
    normalizedNumber: normalizeQuestionNumber(number),
    text,
    page: 1,
    maxMarks: 2,
    confidence: 0.95,
    status: "valid",
  };
}

function a(id: string, text: string, extra?: Partial<Answer>): Answer {
  return {
    id,
    text,
    regions: extra?.regions ?? [
      fromNormalizedFractions({
        page: 1,
        normalizedX: 0.1,
        normalizedY: 0.2,
        normalizedWidth: 0.8,
        normalizedHeight: 0.2,
        pageWidth: 595,
        pageHeight: 842,
      }),
    ],
    confidence: extra?.confidence ?? 0.9,
    status: extra?.status ?? "valid",
    questionReference: extra?.questionReference,
    reviewReason: extra?.reviewReason,
    continuedFromPrevious: extra?.continuedFromPrevious,
  };
}

describe("question number normalization", () => {
  it("normalizes common printed variants", () => {
    expect(normalizeQuestionNumber("11(a)")).toBe("11(a)");
    expect(normalizeQuestionNumber("11 (a)")).toBe("11(a)");
    expect(normalizeQuestionNumber("Q11(a)")).toBe("11(a)");
    expect(normalizeQuestionNumber("Q.11(a)")).toBe("11(a)");
    expect(normalizeQuestionNumber("11-a")).toBe("11(a)");
    expect(normalizeQuestionNumber("11)")).toBe("11");
    expect(normalizeQuestionNumber("11.")).toBe("11");
    expect(displayQuestionNumber("11(a)")).toBe("11 (a)");
  });

  it("treats labelled subparts as independent numbers", () => {
    expect(normalizeQuestionNumber("11(a)")).not.toBe(normalizeQuestionNumber("11(b)"));
    expect(normalizeQuestionNumber("13 (a)")).toBe("13(a)");
  });
});

describe("section mark formulas", () => {
  it("reads 5 × 4 = 20 as 4 marks per question, not 20", () => {
    expect(marksPerQuestionFromFormula("5 × 4 = 20")).toBe(4);
    expect(marksPerQuestionFromFormula("5x4=20")).toBe(4);
    expect(marksPerQuestionFromFormula("3 × 10 = 30")).toBe(10);
    expect(marksPerQuestionFromFormula("2 × 15 = 30")).toBe(15);
  });

  it("rejects formulas that do not multiply to the printed total", () => {
    expect(marksPerQuestionFromFormula("5 × 4 = 21")).toBeNull();
    expect(marksPerQuestionFromFormula("80 marks")).toBeNull();
  });
});

describe("answer mapping", () => {
  it("maps ordered explicit numbers", () => {
    const questions = [q("q_1", "1", "Define osmosis."), q("q_2", "2", "Define diffusion.")];
    const answers = [a("a1", "Q1 Osmosis is...", { questionReference: "1" }), a("a2", "Q2 Diffusion is...", { questionReference: "2" })];
    const { mappings } = explicitMap(questions, answers);
    expect(mappings.find((item) => item.questionId === "q_1")?.answerId).toBe("a1");
    expect(mappings.find((item) => item.questionId === "q_2")?.answerId).toBe("a2");
  });

  it("maps out-of-order answers without reordering questions", () => {
    const questions = [q("q_1", "1", "Q1"), q("q_2", "2", "Q2"), q("q_5", "5", "Q5")];
    const answers = [
      a("a5", "Q5 first", { questionReference: "5" }),
      a("a2", "Q2 second", { questionReference: "2" }),
      a("a1", "Q1 last", { questionReference: "1" }),
    ];
    const { mappings } = explicitMap(questions, answers);
    expect(questions.map((item) => item.id)).toEqual(["q_1", "q_2", "q_5"]);
    expect(mappings.find((item) => item.questionId === "q_1")?.answerId).toBe("a1");
    expect(mappings.find((item) => item.questionId === "q_5")?.answerId).toBe("a5");
  });

  it("keeps 11(a) and 11(b) independent", () => {
    const questions = [q("q_11_a", "11(a)", "Classify."), q("q_11_b", "11(b)", "Regress.")];
    const answers = [
      a("aa", "Ans 11(a) classification", { questionReference: "11(a)" }),
      a("ab", "Ans 11(b) regression", { questionReference: "11 (b)" }),
    ];
    const { mappings } = explicitMap(questions, answers);
    expect(mappings).toHaveLength(2);
    expect(mappings.find((item) => item.questionId === "q_11_a")?.answerId).toBe("aa");
    expect(mappings.find((item) => item.questionId === "q_11_b")?.answerId).toBe("ab");
  });

  it("marks unanswered questions", () => {
    const questions = [q("q_1", "1", "Q1"), q("q_4", "4", "Q4")];
    const answers = [a("a1", "Q1 answered", { questionReference: "1" })];
    const explicit = explicitMap(questions, answers);
    const unanswered = unansweredMappings(questions, explicit.mappedQuestionIds);
    expect(unanswered).toHaveLength(1);
    expect(unanswered[0]?.questionId).toBe("q_4");
    expect(unanswered[0]?.status).toBe("unanswered");
  });

  it("marks unmatched answers", () => {
    const questions = [q("q_1", "1", "Q1")];
    const answers = [a("a1", "Q1", { questionReference: "1" }), a("extra", "cricket match notes")];
    const explicit = explicitMap(questions, answers);
    const marked = markUnmatchedAnswers(answers, explicit.mappedAnswerIds);
    expect(marked.find((item) => item.id === "extra")?.status).toBe("unmatched");
  });

  it("keeps multi-page regions on one answer", () => {
    const answer = a("a2", "Q2 continued", {
      questionReference: "2",
      regions: [
        fromNormalizedFractions({ page: 1, normalizedX: 0.1, normalizedY: 0.2, normalizedWidth: 0.8, normalizedHeight: 0.3, pageWidth: 595, pageHeight: 842 }),
        fromNormalizedFractions({ page: 2, normalizedX: 0.1, normalizedY: 0.1, normalizedWidth: 0.8, normalizedHeight: 0.25, pageWidth: 595, pageHeight: 842 }),
      ],
    });
    expect(answer.regions).toHaveLength(2);
    expect(answer.regions.map((region) => region.page)).toEqual([1, 2]);
  });

  it("flags low-confidence semantic mapping for review", () => {
    const questions = [q("q_7_b", "7(b)", "List two factors.")];
    const answers = [a("a7b", "temperature maybe", { confidence: 0.58 })];
    const mapped = applySemanticMatches(
      questions,
      answers,
      [{ questionId: "q_7_b", answerId: "a7b", confidence: 0.58 }],
      new Set(),
      new Set(),
    );
    expect(mapped[0]?.status).toBe("review_required");
  });

  it("does not treat unreadable handwriting as a confident answer", () => {
    const answer = a("poor", "", { confidence: 0.4, status: "review_required", reviewReason: "unreadable" });
    expect(answer.status).toBe("review_required");
    expect(answer.confidence).toBeLessThan(0.55);
  });

  it("does not inflate explicit mapping confidence", () => {
    const questions = [q("q_1", "1", "Q1")];
    const answers = [a("a1", "Q1 text", { questionReference: "1", confidence: 0.6 })];
    const { mappings } = explicitMap(questions, answers);
    expect(mappings[0]?.confidence).toBe(0.6);
    expect(mappings[0]?.status).toBe("review_required");
  });

  it("does not guess when a number matches more than one question", () => {
    const questions = [q("q_1", "1", "First"), q("q_1_dup", "1", "Second")];
    const answers = [a("a1", "Q1 text", { questionReference: "1" })];
    const { mappings, mappedAnswerIds } = explicitMap(questions, answers);
    expect(mappings).toHaveLength(0);
    expect(mappedAnswerIds.size).toBe(0);
  });

  it("flags a second explicit match to the same question as conflict", () => {
    const questions = [q("q_1", "1", "Q1")];
    const answers = [
      a("a1", "Q1 first", { questionReference: "1" }),
      a("a2", "Q1 again", { questionReference: "1" }),
    ];
    const { mappings } = explicitMap(questions, answers);
    expect(mappings.map((item) => item.status)).toEqual(["mapped", "conflict"]);
  });

  it("does not merge unrelated answers just because they are on the next page", () => {
    const merged = mergeContinuedAnswers([
      a("a1", "Q1 answer", {
        questionReference: "1",
        regions: [fromNormalizedFractions({ page: 1, normalizedX: 0.1, normalizedY: 0.2, normalizedWidth: 0.8, normalizedHeight: 0.2, pageWidth: 595, pageHeight: 842 })],
      }),
      a("a2", "A different scribble", {
        regions: [fromNormalizedFractions({ page: 2, normalizedX: 0.1, normalizedY: 0.2, normalizedWidth: 0.8, normalizedHeight: 0.2, pageWidth: 595, pageHeight: 842 })],
      }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("merges a continuation flagged for the next page", () => {
    const merged = mergeContinuedAnswers([
      a("a1", "Photosynthesis starts here", {
        questionReference: "2",
        regions: [fromNormalizedFractions({ page: 1, normalizedX: 0.1, normalizedY: 0.6, normalizedWidth: 0.8, normalizedHeight: 0.3, pageWidth: 595, pageHeight: 842 })],
      }),
      a("a2", "and continues on the next page", {
        continuedFromPrevious: true,
        regions: [fromNormalizedFractions({ page: 2, normalizedX: 0.1, normalizedY: 0.1, normalizedWidth: 0.8, normalizedHeight: 0.25, pageWidth: 595, pageHeight: 842 })],
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.regions.map((region) => region.page)).toEqual([1, 2]);
  });
});

describe("files and AI failures", () => {
  it("rejects invalid documents", async () => {
    const file = new File([Buffer.from("hello")], "notes.txt", { type: "text/plain" });
    await expect(validateUpload(file, "Question paper")).rejects.toThrow(/PDF, PNG, JPG, or JPEG/i);
  });

  it("rejects empty files", async () => {
    const file = new File([], "paper.pdf", { type: "application/pdf" });
    await expect(validateUpload(file, "Question paper")).rejects.toThrow(/empty/i);
  });

  it("accepts a generated PDF that matches its extension", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const bytes = await readFile(join(process.cwd(), "public/demo/question-paper.pdf"));
    const file = new File([bytes], "paper.pdf", { type: "application/pdf" });
    const result = await validateUpload(file, "Question paper");
    expect(result.mime).toBe("application/pdf");
    expect(result.bytes.length).toBeGreaterThan(100);
  });

  it("rejects corrupted PDFs by magic bytes", async () => {
    const file = new File([Buffer.from("not-a-pdf")], "paper.pdf", { type: "application/pdf" });
    await expect(validateUpload(file, "Question paper")).rejects.toThrow(/corrupted|supported/i);
  });

  it("maps quota errors without leaking SDK text", () => {
    const error = toAppError(new Error("You exceeded your current quota"));
    expect(error.code).toBe("AI_RATE_LIMIT");
    expect(error.message).toMatch(/quota|rate/i);
  });

  it("maps missing-model errors to a current Gemini model hint", () => {
    const error = toAppError(new Error("This model models/gemini-2.5-flash is no longer available to new users. 404"));
    expect(error.code).toBe("AI_UNAVAILABLE");
    expect(error.message).toMatch(/gemini-3\.6-flash/i);
    expect(error.message).not.toMatch(/gemini-2\.5-flash/i);
  });

  it("maps quota errors without a generic processing-failed banner", () => {
    const error = toAppError(new Error("You exceeded your current quota"));
    expect(error.code).toBe("AI_RATE_LIMIT");
    expect(error.message).toMatch(/quota|rate/i);
  });

  it("does not expose raw SDK messages to the client", () => {
    const error = toAppError(new Error("upstream stack dump with internal token xyz"));
    expect(error.message).not.toMatch(/xyz|stack dump/i);
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("rejects malformed AI JSON with Zod", () => {
    const parsed = aiQuestionExtractionSchema.safeParse({ questions: [{ number: "1" }] });
    expect(parsed.success).toBe(false);
  });
});

describe("written-content scoring", () => {
  it("does not award full marks on a 5-mark question with a thin answer", () => {
    const awarded = scoreFromWrittenContent({
      score: 5,
      maxMarks: 5,
      answerText: "Chlorophyll is a green pigment.",
    });
    expect(awarded.score).toBe(4);
    expect(awarded.correctness).toBe("partial");
  });

  it("keeps full marks when the writing is complete enough", () => {
    const awarded = scoreFromWrittenContent({
      score: 5,
      maxMarks: 5,
      answerText:
        "Photosynthesis occurs in chloroplasts. Carbon dioxide and water are converted into glucose and oxygen using sunlight and chlorophyll. The process stores energy in chemical bonds for the plant.",
    });
    expect(awarded.score).toBe(5);
    expect(awarded.correctness).toBe("correct");
  });

  it("still allows full marks on a short 1-mark fact", () => {
    const awarded = scoreFromWrittenContent({
      score: 1,
      maxMarks: 1,
      answerText: "Arteries",
    });
    expect(awarded.score).toBe(1);
    expect(awarded.correctness).toBe("correct");
  });
});

describe("coordinates and duplicates", () => {
  it("rejects invented whole-page or tiny boxes", () => {
    expect(isReliableRegion({ normalizedX: 0, normalizedY: 0, normalizedWidth: 1, normalizedHeight: 1 })).toBe(false);
    expect(isReliableRegion({ normalizedX: 0.1, normalizedY: 0.1, normalizedWidth: 0.01, normalizedHeight: 0.01 })).toBe(false);
    expect(isReliableRegion({ normalizedX: 0.1, normalizedY: 0.2, normalizedWidth: 0.8, normalizedHeight: 0.25 })).toBe(true);
  });

  it("expands a tight Gemini box to cover the answer label and last line", () => {
    const tight = fromNormalizedFractions({
      page: 1,
      normalizedX: 0.22,
      normalizedY: 0.4,
      normalizedWidth: 0.62,
      normalizedHeight: 0.12,
    });
    const expanded = expandHighlightRegion(tight);
    expect(expanded.normalizedX).toBeLessThan(tight.normalizedX);
    expect(expanded.normalizedX + expanded.normalizedWidth).toBeGreaterThan(tight.normalizedX + tight.normalizedWidth);
  });

  it("does not stretch a one-line answer through leftover blank lines", () => {
    const oversized = fromNormalizedFractions({
      page: 1,
      normalizedX: 0.1,
      normalizedY: 0.4,
      normalizedWidth: 0.8,
      normalizedHeight: 0.18,
    });
    const next = fromNormalizedFractions({
      page: 1,
      normalizedX: 0.1,
      normalizedY: 0.62,
      normalizedWidth: 0.8,
      normalizedHeight: 0.05,
    });
    const fitted = clipHighlightToNeighbors(expandHighlightRegion(oversized), [next], "Ans. 4 (A) 1665");
    expect(fitted.normalizedY + fitted.normalizedHeight).toBeLessThanOrEqual(next.normalizedY - 0.005);
    expect(fitted.normalizedHeight).toBeLessThan(0.09);
  });

  it("clips using page position, not question order", () => {
    const laterQuestion = fromNormalizedFractions({
      page: 1,
      normalizedX: 0.1,
      normalizedY: 0.2,
      normalizedWidth: 0.8,
      normalizedHeight: 0.2,
    });
    const earlierQuestionBelow = fromNormalizedFractions({
      page: 1,
      normalizedX: 0.1,
      normalizedY: 0.36,
      normalizedWidth: 0.8,
      normalizedHeight: 0.06,
    });
    const fitted = clipHighlightToNeighbors(expandHighlightRegion(laterQuestion), [earlierQuestionBelow], "Mitochondria produce energy.");
    expect(fitted.normalizedY + fitted.normalizedHeight).toBeLessThanOrEqual(earlierQuestionBelow.normalizedY - 0.005);
  });

  it("maps Q9 to the math block, not the last line of Q8", () => {
    const box = (y: number, height: number) =>
      fromNormalizedFractions({ page: 1, normalizedX: 0.08, normalizedY: y, normalizedWidth: 0.84, normalizedHeight: height });
    const q8 = {
      text: "Mitochondria are known as the powerhouse of the cell because they generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.",
      regions: [box(0.52, 0.1)],
    };
    const q9 = {
      text: "2x + 5 = 15 => 2x = 15 - 5 => 2x = 10 => x = 5",
      regions: [box(0.61, 0.035)],
    };
    const q10 = {
      text: "The water cycle consists of evaporation, condensation, precipitation, and collection. Water evaporates from oceans, condenses into clouds, falls as rain, and collects in rivers and lakes.",
      regions: [box(0.78, 0.12)],
    };
    const q9Box = highlightFromAnswer(q9, "Q9", [q8, q10])[0]?.region;
    const q8Box = highlightFromAnswer(q8, "Q8", [q9, q10])[0]?.region;
    expect(q9Box).toBeDefined();
    expect(q8Box).toBeDefined();
    expect(q9Box!.normalizedY).toBeGreaterThanOrEqual(q8Box!.normalizedY + q8Box!.normalizedHeight - 0.002);
    expect(q9Box!.normalizedHeight).toBeGreaterThan(0.07);
    expect(q9Box!.normalizedY + q9Box!.normalizedHeight).toBeLessThanOrEqual(q10.regions[0]!.normalizedY + 0.002);
  });

  it("detects duplicate mappings", () => {
    const mappings: Mapping[] = [
      { id: "m1", questionId: "q_1", answerId: "a1", confidence: 0.9, status: "mapped", method: "explicit" },
      { id: "m2", questionId: "q_2", answerId: "a1", confidence: 0.9, status: "mapped", method: "semantic" },
    ];
    const result = detectDuplicateMappings(mappings);
    expect(result.every((item) => item.status === "conflict")).toBe(true);
  });

  it("records rotation metadata rather than inventing content", () => {
    const demo = getDemoAssessment();
    expect(demo.processingMetadata.answerDocument.pages.every((page) => page.rotation === 0 || Number.isFinite(page.rotation))).toBe(true);
  });
});

describe("demo dataset edge cases", () => {
  it("includes unanswered, unmatched, multi-page, low-confidence and out-of-order answers", () => {
    const demo = getDemoAssessment();
    expect(demo.questions.map((item) => item.normalizedNumber)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7(a)",
      "7(b)",
      "8",
    ]);
    expect(demo.mappings.find((item) => item.questionId === "q_4")?.status).toBe("unanswered");
    expect(demo.unmatchedAnswers.length).toBeGreaterThan(0);
    expect(demo.answers.find((item) => item.id === "answer_002")?.regions.map((region) => region.page)).toEqual([1, 2]);
    expect(demo.mappings.find((item) => item.questionId === "q_7_b")?.status).toBe("review_required");
    const firstAnswerRef = demo.answers[0]?.questionReference;
    expect(firstAnswerRef).toBe("5");
  });

  it("applies manual review without hallucinating a new answer", () => {
    const demo = getDemoAssessment();
    const updated = applyManualMapping(demo, "q_4", "answer_unmapped");
    expect(updated.mappings.find((item) => item.questionId === "q_4")?.status).toBe("mapped");
    expect(updated.mappings.find((item) => item.questionId === "q_4")?.method).toBe("manual");
  });

  it("finalizes coverage for every question", () => {
    const demo = getDemoAssessment();
    const covered = new Set(demo.mappings.map((item) => item.questionId));
    expect([...covered].sort()).toEqual(demo.questions.map((item) => item.id).sort());
    expect(finalizeAssessment(demo).summary.totalQuestions).toBe(9);
  });
});

describe("reference extraction", () => {
  it("reads explicit student numbering", () => {
    expect(extractQuestionReference("Ans: 11(a) The answer")).toBe("11(a)");
    expect(extractQuestionReference("Q2. Photosynthesis")).toBe("2");
    expect(extractQuestionReference("1. What were the causes of the French Revolution?")).toBe("1");
    expect(extractQuestionReference("4. Briefly explain the Simon Commission.")).toBe("4");
  });
});

describe("stream and file sniffing", () => {
  it("rejects malformed stream lines instead of throwing", () => {
    expect(parseStreamEvent("{not json")).toBeNull();
    expect(parseStreamEvent('{"type":"complete"}')).toEqual({ type: "complete" });
  });

  it("rejects malformed AI JSON wrappers", () => {
    expect(() => safeJsonParse("not json at all")).toThrow();
    expect(aiQuestionExtractionSchema.safeParse(safeJsonParse('{"questions":[]}')).success).toBe(true);
  });

  it("sniffs real file signatures and rejects renamed junk", () => {
    expect(sniffMime(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });
});

describe("finalization", () => {
  it("surfaces unused low-confidence answers as unmatched", () => {
    const demo = getDemoAssessment();
    const result = finalizeAssessment({
      questions: [q("q_1", "1", "Q1")],
      answers: [
        a("a1", "Q1", { questionReference: "1" }),
        a("a2", "unclear scribble", { status: "review_required", confidence: 0.4 }),
      ],
      mappings: [{ id: "m1", questionId: "q_1", answerId: "a1", confidence: 0.9, status: "mapped", method: "explicit" }],
      grades: [],
      processingMetadata: demo.processingMetadata,
    });
    expect(result.answers.find((item) => item.id === "a2")?.status).toBe("unmatched");
    expect(result.unmatchedAnswers.some((item) => item.id === "a2")).toBe(true);
    expect(result.summary.reviewRequired).toBe(0);
    expect(result.summary.unmappedAnswers).toBe(1);
  });

  it("counts unanswered questions as zero in the paper total", () => {
    const demo = getDemoAssessment();
    const questions = Array.from({ length: 14 }, (_, index) =>
      q(`q_${index + 1}`, String(index + 1), `Question ${index + 1}`),
    ).map((question) => ({ ...question, maxMarks: 4 }));
    const mappings: Mapping[] = questions.map((question, index) => ({
      id: `m${index + 1}`,
      questionId: question.id,
      answerId: index < 4 ? `a${index + 1}` : null,
      confidence: index < 4 ? 0.9 : 0,
      status: index < 4 ? "mapped" : "unanswered",
      method: index < 4 ? "explicit" : "none",
    }));
    const grades = questions.slice(0, 4).map((question, index) => ({
      questionId: question.id,
      answerId: `a${index + 1}`,
      score: 4,
      maxMarks: 4,
      correctness: "correct" as const,
      feedback: "Complete.",
      confidence: 0.9,
      status: "valid" as const,
    }));
    const result = finalizeAssessment({
      questions,
      answers: grades.map((grade) => a(grade.answerId, "Full answer")),
      mappings,
      grades,
      processingMetadata: demo.processingMetadata,
    });
    expect(result.summary.answered).toBe(4);
    expect(result.summary.unanswered).toBe(10);
    expect(result.summary.score).toBe(16);
    expect(result.summary.maxScore).toBe(56);
    expect(result.summary.percentage).toBe(28.6);
  });
});
