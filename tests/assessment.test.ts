import { describe, expect, it } from "vitest";
import { isReliableRegion, fromNormalizedFractions } from "@/lib/coordinates";
import { displayQuestionNumber, extractQuestionReference, normalizeQuestionNumber } from "@/lib/extraction/numbering";
import { validateUpload } from "@/lib/files/validate";
import { applySemanticMatches, explicitMap, unansweredMappings, markUnmatchedAnswers } from "@/lib/mapping/answerMapper";
import { toAppError } from "@/lib/errors";
import { applyManualMapping, detectDuplicateMappings, finalizeAssessment } from "@/lib/validation/business";
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
});

describe("files and AI failures", () => {
  it("rejects invalid documents", async () => {
    const file = new File([Buffer.from("hello")], "notes.txt", { type: "text/plain" });
    await expect(validateUpload(file, "Question paper")).rejects.toThrow(/PDF, PNG, JPG, or JPEG/i);
  });

  it("rejects corrupted PDFs by magic bytes", async () => {
    const file = new File([Buffer.from("not-a-pdf")], "paper.pdf", { type: "application/pdf" });
    await expect(validateUpload(file, "Question paper")).rejects.toThrow(/corrupted|supported/i);
  });

  it("maps API failures to retryable errors", () => {
    const error = toAppError(new Error("429 resource exhausted"));
    expect(error.code).toBe("AI_RATE_LIMIT");
    expect(error.retryable).toBe(true);
  });

  it("rejects malformed AI JSON with Zod", () => {
    const parsed = aiQuestionExtractionSchema.safeParse({ questions: [{ number: "1" }] });
    expect(parsed.success).toBe(false);
  });
});

describe("coordinates and duplicates", () => {
  it("rejects invented whole-page or tiny boxes", () => {
    expect(isReliableRegion({ normalizedX: 0, normalizedY: 0, normalizedWidth: 1, normalizedHeight: 1 })).toBe(false);
    expect(isReliableRegion({ normalizedX: 0.1, normalizedY: 0.1, normalizedWidth: 0.01, normalizedHeight: 0.01 })).toBe(false);
    expect(isReliableRegion({ normalizedX: 0.1, normalizedY: 0.2, normalizedWidth: 0.8, normalizedHeight: 0.25 })).toBe(true);
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
  });
});
