import { generateValidatedJson } from "@/lib/ai/gemini";
import { ANSWER_EXTRACTION_PROMPT } from "@/lib/ai/prompts";
import { HIGH_CONFIDENCE } from "@/lib/constants";
import { fromNormalizedFractions } from "@/lib/coordinates";
import { AppError } from "@/lib/errors";
import { normalizeQuestionNumber } from "@/lib/extraction/numbering";
import { mergeContinuedAnswers } from "@/lib/mapping/answerMapper";
import { log } from "@/lib/logging";
import { uniqueId } from "@/lib/utils";
import { aiAnswerExtractionSchema } from "@/lib/validation/schemas";
import { validateAnswers } from "@/lib/validation/business";
import type { PreparedDocument } from "@/lib/extraction/preprocessing";
import type { Answer } from "@/types/assessment";

export async function extractAnswers(document: PreparedDocument): Promise<{ answers: Answer[]; warnings: string[] }> {
  log.info("Answer extraction started", { pages: document.meta.pageCount });

  const result = await generateValidatedJson({
    prompt: ANSWER_EXTRACTION_PROMPT,
    documents: [{ mime: document.aiMime, bytes: document.aiBytes, filename: document.meta.filename }],
    extraText: `The answer sheet has ${document.meta.pageCount} page(s). Coordinates are fractions of each page, origin top-left.`,
    schema: aiAnswerExtractionSchema,
    label: "answer extraction",
  });

  if (!result.answers.length) {
    log.warn("No answers detected");
    return { answers: [], warnings: result.warnings ?? ["No handwritten answers were detected."] };
  }

  const pageSizes = new Map(document.meta.pages.map((page) => [page.page, page]));

  const raw: Answer[] = result.answers.map((item) => {
    const unreadable = Boolean(item.unreadable) || !item.text.trim();
    const regions = item.regions
      .filter((region) => region.page >= 1 && region.page <= document.meta.pageCount)
      .map((region) => {
        const page = pageSizes.get(region.page);
        return fromNormalizedFractions({
          page: region.page,
          normalizedX: region.normalizedX,
          normalizedY: region.normalizedY,
          normalizedWidth: region.normalizedWidth,
          normalizedHeight: region.normalizedHeight,
          pageWidth: page?.width,
          pageHeight: page?.height,
        });
      })
      .map((region) => ({
        ...region,
        reliable: region.reliable && item.regions.find((source) => source.page === region.page)?.reliable !== false,
      }));

    const reference = item.questionReference ? normalizeQuestionNumber(item.questionReference) : undefined;

    return {
      id: uniqueId("answer"),
      questionReference: reference,
      text: item.text.trim(),
      regions,
      confidence: unreadable ? Math.min(item.confidence, 0.5) : item.confidence,
      status: unreadable || item.confidence < HIGH_CONFIDENCE ? "review_required" : "valid",
      reviewReason: item.reviewReason
        || (unreadable ? "The handwriting on this region could not be confidently interpreted." : undefined)
        || (regions.length === 0 ? "Unable to reliably determine answer region." : undefined),
    };
  });

  const merged = mergeContinuedAnswers(raw);
  const answers = validateAnswers(merged, document.meta.pageCount);

  if (!answers.length) {
    throw new AppError(
      "NO_ANSWERS",
      "No answers could be extracted from the answer sheet. The document may be blank or unreadable.",
    );
  }

  log.info("Answer extraction completed", { count: answers.length });
  return { answers, warnings: result.warnings ?? [] };
}
