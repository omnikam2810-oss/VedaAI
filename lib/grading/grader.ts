import { generateValidatedJson } from "@/lib/ai/gemini";
import { GRADING_PROMPT } from "@/lib/ai/prompts";
import { HIGH_CONFIDENCE } from "@/lib/constants";
import { log } from "@/lib/logging";
import { aiGradingSchema } from "@/lib/validation/schemas";
import type { Answer, Grade, Mapping, Question } from "@/types/assessment";

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
    const grade = result.grades.find((item) => item.questionNumber === pair.question.normalizedNumber);
    const maxMarks = pair.question.maxMarks;
    if (!grade) continue;

    const scoreUnavailable = maxMarks === null || grade.maxMarks === null || grade.score === null;
    grades.push({
      questionId: pair.question.id,
      answerId: pair.answer.id,
      score: scoreUnavailable ? null : Math.min(grade.score ?? 0, maxMarks ?? grade.maxMarks ?? 0),
      maxMarks,
      correctness: scoreUnavailable ? "unavailable" : grade.correctness,
      feedback: grade.feedback.trim(),
      confidence: grade.confidence,
      status: grade.reviewRequired || grade.confidence < HIGH_CONFIDENCE || scoreUnavailable ? "review_required" : "valid",
    });
  }

  log.info("Grading completed", { count: grades.length });
  return { grades, summary: result.summary, warnings: result.warnings ?? [] };
}
