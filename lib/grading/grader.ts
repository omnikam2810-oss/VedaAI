import { generateValidatedJson } from "@/lib/ai/gemini";
import { GRADING_PROMPT } from "@/lib/ai/prompts";
import { HIGH_CONFIDENCE } from "@/lib/constants";
import { log } from "@/lib/logging";
import { aiGradingSchema } from "@/lib/validation/schemas";
import type { Answer, Grade, Mapping, Question } from "@/types/assessment";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function minWordsForFullMarks(maxMarks: number): number {
  if (maxMarks <= 1) return 1;
  if (maxMarks <= 2) return 4;
  if (maxMarks <= 3) return 8;
  return maxMarks * 4;
}

/** Cap full marks when the writing is too thin for that mark value. */
export function scoreFromWrittenContent(input: {
  score: number;
  maxMarks: number;
  answerText: string;
}): { score: number; correctness: Grade["correctness"] } {
  let score = Math.max(0, Math.min(input.maxMarks, Math.round(input.score)));
  if (score >= input.maxMarks && wordCount(input.answerText) < minWordsForFullMarks(input.maxMarks)) {
    score = Math.max(0, input.maxMarks - 1);
  }
  const correctness: Grade["correctness"] =
    score <= 0 ? "incorrect" : score >= input.maxMarks ? "correct" : "partial";
  return { score, correctness };
}

export async function gradeMappedAnswers(
  questions: Question[],
  answers: Answer[],
  mappings: Mapping[],
): Promise<{ grades: Grade[]; summary?: string; warnings: string[] }> {
  const pairs = mappings
    .filter((mapping) => mapping.answerId && mapping.status !== "unanswered")
    .map((mapping) => {
      const question = questions.find((item) => item.id === mapping.questionId);
      const answer = answers.find((item) => item.id === mapping.answerId);
      if (!question || !answer) return null;
      return { mapping, question, answer };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (!pairs.length) {
    return { grades: [], warnings: [] };
  }

  log.info("Grading started", { count: pairs.length });

  const payload = {
    instruction:
      "Award marks from the written content only. Full marks only if the answer is complete enough for that mark value.",
    pairs: pairs.map(({ question, answer }) => ({
      questionNumber: question.normalizedNumber,
      questionText: question.text,
      maxMarks: question.maxMarks,
      answerText: answer.text.slice(0, 1500),
      extractionConfidence: answer.confidence,
    })),
  };

  const result = await generateValidatedJson({
    prompt: GRADING_PROMPT,
    documents: [],
    extraText: JSON.stringify(payload),
    schema: aiGradingSchema,
    label: "grading",
  });

  const grades: Grade[] = [];
  for (const pair of pairs) {
    const grade = result.grades.find(
      (item) =>
        item.questionNumber === pair.question.normalizedNumber ||
        item.questionNumber === pair.question.number ||
        item.questionNumber === pair.question.displayNumber,
    );
    const maxMarks = pair.question.maxMarks;
    if (!grade) continue;

    const scoreUnavailable = maxMarks === null || grade.maxMarks === null || grade.score === null;
    const awarded = scoreUnavailable
      ? null
      : scoreFromWrittenContent({
          score: grade.score ?? 0,
          maxMarks,
          answerText: pair.answer.text,
        });

    grades.push({
      questionId: pair.question.id,
      answerId: pair.answer.id,
      score: awarded?.score ?? null,
      maxMarks,
      correctness: scoreUnavailable ? "unavailable" : awarded?.correctness ?? grade.correctness,
      feedback: grade.feedback.trim(),
      confidence: grade.confidence,
      status: grade.reviewRequired || grade.confidence < HIGH_CONFIDENCE || scoreUnavailable ? "review_required" : "valid",
    });
  }

  log.info("Grading completed", { count: grades.length });
  return { grades, summary: result.summary, warnings: result.warnings ?? [] };
}
