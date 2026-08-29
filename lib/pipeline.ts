import { getModelName } from "@/lib/ai/gemini";
import { INITIAL_STEPS } from "@/lib/constants";
import { extractAnswers } from "@/lib/extraction/answerExtractor";
import { extractQuestions } from "@/lib/extraction/questionExtractor";
import { preprocessDocument } from "@/lib/extraction/preprocessing";
import { gradeMappedAnswers } from "@/lib/grading/grader";
import { getDemoAssessment } from "@/lib/demo/dataset";
import { AppError } from "@/lib/errors";
import { validateUpload } from "@/lib/files/validate";
import { log } from "@/lib/logging";
import { mapAnswers } from "@/lib/mapping/hybridMapper";
import { sleep } from "@/lib/utils";
import { finalizeAssessment } from "@/lib/validation/business";
import type {
  ProcessingStage,
  ProcessingStep,
  StreamEvent,
} from "@/types/assessment";

export type ProgressEmitter = (event: StreamEvent) => void;

function setStep(steps: ProcessingStep[], id: string, status: ProcessingStep["status"], detail?: string): ProcessingStep[] {
  return steps.map((step) => (step.id === id ? { ...step, status, detail } : step));
}

function emitProgress(
  emit: ProgressEmitter,
  stage: ProcessingStage,
  message: string,
  steps: ProcessingStep[],
) {
  emit({ type: "progress", stage, message, steps });
}

export async function runDemoPipeline(emit: ProgressEmitter): Promise<void> {
  let steps = INITIAL_STEPS.map((step) => ({ ...step }));
  const sequence: Array<{ id: string; stage: ProcessingStage; processing: string; done: string }> = [
    { id: "question_upload", stage: "uploading", processing: "Uploading question paper...", done: "Question paper uploaded" },
    { id: "question_extraction", stage: "extracting_questions", processing: "Extracting questions...", done: "Question extraction completed" },
    { id: "answer_upload", stage: "uploading", processing: "Uploading answer sheet...", done: "Answer sheet uploaded" },
    { id: "preprocessing", stage: "preprocessing", processing: "Processing documents...", done: "Document processing completed" },
    { id: "answer_extraction", stage: "extracting_answers", processing: "Extracting handwritten answers...", done: "Handwritten answer extraction completed" },
    { id: "mapping", stage: "mapping_answers", processing: "Mapping answers to questions...", done: "Answer mapping completed" },
    { id: "assessment", stage: "grading", processing: "Analysing assessment...", done: "Assessment analysis completed" },
  ];

  for (const item of sequence) {
    steps = setStep(steps, item.id, "processing");
    emitProgress(emit, item.stage, item.processing, steps);
    await sleep(280);
    steps = setStep(steps, item.id, "completed", item.done);
    emitProgress(emit, item.stage, item.done, steps);
  }

  emit({ type: "complete", assessment: getDemoAssessment() });
}

export async function runAssessmentPipeline(
  questionFile: File,
  answerFile: File,
  emit: ProgressEmitter,
): Promise<void> {
  const started = Date.now();
  const startedAt = new Date().toISOString();
  let steps = INITIAL_STEPS.map((step) => ({ ...step }));
  const warnings: string[] = [];

  try {
    steps = setStep(steps, "question_upload", "processing");
    emitProgress(emit, "uploading", "Validating question paper...", steps);
    const questionUpload = await validateUpload(questionFile, "Question paper");
    steps = setStep(steps, "question_upload", "completed", "Uploaded");
    emitProgress(emit, "uploading", "Question paper uploaded", steps);

    steps = setStep(steps, "answer_upload", "processing");
    emitProgress(emit, "uploading", "Validating answer sheet...", steps);
    const answerUpload = await validateUpload(answerFile, "Answer sheet");
    steps = setStep(steps, "answer_upload", "completed", "Uploaded");
    emitProgress(emit, "uploading", "Answer sheet uploaded", steps);

    steps = setStep(steps, "preprocessing", "processing");
    emitProgress(emit, "preprocessing", "Preparing documents...", steps);
    const questionDoc = await preprocessDocument({
      ...questionUpload,
      kind: "question_paper",
    });
    const answerDoc = await preprocessDocument({
      ...answerUpload,
      kind: "answer_sheet",
    });
    if (questionDoc.meta.pages.some((page) => page.blank)) {
      warnings.push("A blank page was detected in the question paper.");
    }
    if (answerDoc.meta.pages.some((page) => page.blank)) {
      warnings.push("A blank page was detected in the answer sheet.");
    }
    steps = setStep(steps, "preprocessing", "completed", "Completed");
    emitProgress(emit, "preprocessing", "Document processing completed", steps);

    steps = setStep(steps, "question_extraction", "processing");
    emitProgress(emit, "extracting_questions", "Extracting questions...", steps);
    const extractedQuestions = await extractQuestions(questionDoc);
    warnings.push(...extractedQuestions.warnings);
    steps = setStep(steps, "question_extraction", "completed", `${extractedQuestions.questions.length} questions`);
    emitProgress(emit, "extracting_questions", "Question extraction completed", steps);

    steps = setStep(steps, "answer_extraction", "processing");
    emitProgress(emit, "extracting_answers", "Extracting handwritten answers...", steps);
    const extractedAnswers = await extractAnswers(answerDoc);
    warnings.push(...extractedAnswers.warnings);
    steps = setStep(steps, "answer_extraction", "completed", `${extractedAnswers.answers.length} answers`);
    emitProgress(emit, "extracting_answers", "Handwritten answer extraction completed", steps);

    steps = setStep(steps, "mapping", "processing");
    emitProgress(emit, "mapping_answers", "Mapping answers to questions...", steps);
    const mapped = await mapAnswers(extractedQuestions.questions, extractedAnswers.answers);
    warnings.push(...mapped.warnings);
    steps = setStep(steps, "mapping", "completed", "Completed");
    emitProgress(emit, "mapping_answers", "Answer mapping completed", steps);

    steps = setStep(steps, "assessment", "processing");
    emitProgress(emit, "grading", "Analysing assessment...", steps);
    let grades = [] as Awaited<ReturnType<typeof gradeMappedAnswers>>["grades"];
    let aiSummary: string | undefined;
    try {
      const graded = await gradeMappedAnswers(extractedQuestions.questions, mapped.answers, mapped.mappings);
      grades = graded.grades;
      aiSummary = graded.summary;
      warnings.push(...graded.warnings);
    } catch (error) {
      log.warn("Grading skipped", { reason: error instanceof Error ? error.message : "unknown" });
      warnings.push("Grading was skipped because the AI grading step failed. Extraction and mapping are still available.");
    }

    const assessment = finalizeAssessment({
      questions: extractedQuestions.questions,
      answers: mapped.answers,
      mappings: mapped.mappings,
      grades,
      paperScheme: extractedQuestions.paperScheme,
      processingMetadata: {
        isDemo: false,
        model: getModelName(),
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        warnings,
        questionDocument: questionDoc.meta,
        answerDocument: answerDoc.meta,
      },
    });
    if (aiSummary) {
      const hasChoice = Boolean(extractedQuestions.paperScheme?.paperMaxMarks || extractedQuestions.paperScheme?.sections.length);
      assessment.summary.aiSummary = hasChoice
        ? `${aiSummary} Paper total uses the printed maximum marks (internal choice). Unused optional questions are not added to that total.`
        : assessment.summary.unanswered > 0
          ? `${aiSummary} ${assessment.summary.unanswered} unanswered question(s) were scored 0.`
          : aiSummary;
    }

    steps = setStep(steps, "assessment", "completed", "Completed");
    emitProgress(emit, "completed", "Assessment analysis completed", steps);
    log.info("Assessment completed", {
      questions: assessment.questions.length,
      answers: assessment.answers.length,
      durationMs: assessment.processingMetadata.durationMs,
    });
    emit({ type: "complete", assessment });
  } catch (error) {
    const failed = steps.map((step) =>
      step.status === "processing" ? { ...step, status: "failed" as const } : step,
    );
    emitProgress(emit, "failed", error instanceof Error ? error.message : "Processing failed", failed);
    throw error;
  }
}

export function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function missingKeyError(): AppError {
  return new AppError(
    "AI_UNAVAILABLE",
    "Gemini API key is not configured. Add GEMINI_API_KEY in .env.local, or run Demo Mode to explore the product without consuming API quota.",
    { status: 503, retryable: false },
  );
}
