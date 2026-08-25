import { generateValidatedJson } from "@/lib/ai/gemini";
import { QUESTION_EXTRACTION_PROMPT } from "@/lib/ai/prompts";
import { HIGH_CONFIDENCE } from "@/lib/constants";
import { displayQuestionNumber, normalizeQuestionNumber, questionIdFromNumber } from "@/lib/extraction/numbering";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logging";
import { aiQuestionExtractionSchema } from "@/lib/validation/schemas";
import { validateQuestions } from "@/lib/validation/business";
import type { PreparedDocument } from "@/lib/extraction/preprocessing";
import type { Question } from "@/types/assessment";

export async function extractQuestions(document: PreparedDocument): Promise<{ questions: Question[]; warnings: string[] }> {
  log.info("Question extraction started", { pages: document.meta.pageCount });

  const result = await generateValidatedJson({
    prompt: QUESTION_EXTRACTION_PROMPT,
    documents: [{ mime: document.aiMime, bytes: document.aiBytes, filename: document.meta.filename }],
    extraText: `The question paper has ${document.meta.pageCount} page(s). Use only those page numbers.`,
    schema: aiQuestionExtractionSchema,
    label: "question extraction",
  });

  if (!result.questions.length) {
    throw new AppError(
      "NO_QUESTIONS",
      "No questions could be detected in the question paper. Please check the document quality and retry.",
    );
  }

  const questions = validateQuestions(
    result.questions.map((item, index) => {
      const normalizedNumber = normalizeQuestionNumber(item.number);
      const confidence = item.ambiguous ? Math.min(item.confidence, 0.74) : item.confidence;
      return {
        id: questionIdFromNumber(normalizedNumber) + (normalizedNumber ? "" : `_${index + 1}`),
        number: item.number.trim(),
        displayNumber: displayQuestionNumber(item.number),
        normalizedNumber,
        text: item.text.trim(),
        page: item.page,
        maxMarks: item.maxMarks ?? null,
        confidence,
        status: confidence >= HIGH_CONFIDENCE && !item.ambiguous ? "valid" : "review_required",
        reviewReason: item.reviewReason || (item.ambiguous ? "Ambiguous question extraction." : undefined),
      };
    }),
    document.meta.pageCount,
  );

  const unique = new Map<string, Question>();
  questions.forEach((question, index) => {
    const key = question.id;
    if (unique.has(key)) {
      unique.set(`${key}_${index + 1}`, { ...question, id: `${key}_${index + 1}` });
    } else {
      unique.set(key, question);
    }
  });

  log.info("Question extraction completed", { count: unique.size });
  return { questions: [...unique.values()], warnings: result.warnings ?? [] };
}
