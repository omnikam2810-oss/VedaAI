import { generateValidatedJson } from "@/lib/ai/gemini";
import { QUESTION_EXTRACTION_PROMPT } from "@/lib/ai/prompts";
import { HIGH_CONFIDENCE } from "@/lib/constants";
import { displayQuestionNumber, normalizeQuestionNumber, questionIdFromNumber } from "@/lib/extraction/numbering";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logging";
import { aiQuestionExtractionSchema } from "@/lib/validation/schemas";
import { validateQuestions } from "@/lib/validation/business";
import type { PreparedDocument } from "@/lib/extraction/preprocessing";
import type { PaperScheme, Question } from "@/types/assessment";

export async function extractQuestions(document: PreparedDocument): Promise<{
  questions: Question[];
  warnings: string[];
  paperScheme: PaperScheme | null;
}> {
  log.info("Question extraction started", { pages: document.meta.pageCount });

  const result = await generateValidatedJson({
    prompt: QUESTION_EXTRACTION_PROMPT,
    documents: [{ mime: document.aiMime, bytes: document.aiBytes, filename: document.meta.filename }],
    extraText: `The question paper has ${document.meta.pageCount} page(s). Use only those page numbers. If a section shows 5 × 4 = 20, each question in that section is worth 4 marks, not 20. If the header shows M.M. 80, paperMaxMarks is 80 — do not sum every listed optional question.`,
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

  const questionsOut = [...unique.values()];
  const paperScheme = buildPaperScheme(result, questionsOut);
  log.info("Question extraction completed", {
    count: questionsOut.length,
    paperMaxMarks: paperScheme?.paperMaxMarks ?? 0,
    sections: paperScheme?.sections.length ?? 0,
  });
  return { questions: questionsOut, warnings: result.warnings ?? [], paperScheme };
}

function buildPaperScheme(
  result: { paperMaxMarks?: number | null; sections?: Array<{
    label?: string;
    attemptAny: number;
    marksPerQuestion: number;
    sectionTotal: number;
    questionNumbers: string[];
  }> },
  questions: Question[],
): PaperScheme | null {
  const paperMaxMarks = result.paperMaxMarks && result.paperMaxMarks > 0 ? result.paperMaxMarks : null;
  const sections = (result.sections ?? []).flatMap((section, index) => {
    if (section.attemptAny * section.marksPerQuestion !== section.sectionTotal) return [];
    const questionIds = section.questionNumbers
      .map((number) => {
        const normalized = normalizeQuestionNumber(number);
        return questions.find((question) => question.normalizedNumber === normalized)?.id;
      })
      .filter((id): id is string => Boolean(id));
    if (!questionIds.length) return [];
    return [{
      id: `section_${index + 1}`,
      label: section.label,
      attemptAny: section.attemptAny,
      marksPerQuestion: section.marksPerQuestion,
      sectionTotal: section.sectionTotal,
      questionIds,
    }];
  });
  if (!paperMaxMarks && !sections.length) return null;
  return { paperMaxMarks, sections };
}
