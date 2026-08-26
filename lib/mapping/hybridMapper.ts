import { generateValidatedJson } from "@/lib/ai/gemini";
import { SEMANTIC_MAPPING_PROMPT } from "@/lib/ai/prompts";
import { questionIdFromNumber } from "@/lib/extraction/numbering";
import { log } from "@/lib/logging";
import {
  applySemanticMatches,
  explicitMap,
  markUnmatchedAnswers,
  unansweredMappings,
  type SemanticMatch,
} from "@/lib/mapping/answerMapper";
import { aiSemanticMappingSchema } from "@/lib/validation/schemas";
import type { Answer, Mapping, Question } from "@/types/assessment";

async function semanticMatches(questions: Question[], answers: Answer[]): Promise<SemanticMatch[]> {
  if (!questions.length || !answers.length) return [];

  const payload = {
    questions: questions.map((question) => ({
      number: question.normalizedNumber,
      text: question.text,
    })),
    answers: answers.map((answer, index) => ({
      index,
      questionReference: answer.questionReference ?? null,
      text: answer.text.slice(0, 1200),
    })),
  };

  const result = await generateValidatedJson({
    prompt: SEMANTIC_MAPPING_PROMPT,
    documents: [],
    extraText: JSON.stringify(payload),
    schema: aiSemanticMappingSchema,
    label: "semantic mapping",
  });

  const matches: SemanticMatch[] = [];
  for (const match of result.matches) {
    const answer = answers[match.answerIndex];
    if (!answer) continue;
    const question = questions.find((item) => item.normalizedNumber === match.questionNumber)
      || questions.find((item) => item.id === questionIdFromNumber(match.questionNumber));
    if (!question) continue;
    matches.push({
      questionId: question.id,
      answerId: answer.id,
      confidence: match.confidence,
      reason: match.reason,
    });
  }
  return matches;
}

export async function mapAnswers(questions: Question[], answers: Answer[]): Promise<{
  mappings: Mapping[];
  answers: Answer[];
  warnings: string[];
}> {
  log.info("Mapping started", { questions: questions.length, answers: answers.length });
  const warnings: string[] = [];

  const explicit = explicitMap(questions, answers);
  const leftoverQuestions = questions.filter((question) => !explicit.mappedQuestionIds.has(question.id));
  const leftoverAnswers = answers.filter((answer) => !explicit.mappedAnswerIds.has(answer.id));

  let semantic: Mapping[] = [];
  if (leftoverQuestions.length && leftoverAnswers.length) {
    try {
      const matches = await semanticMatches(leftoverQuestions, leftoverAnswers);
      semantic = applySemanticMatches(
        leftoverQuestions,
        leftoverAnswers,
        matches,
        explicit.mappedAnswerIds,
        explicit.mappedQuestionIds,
      );
    } catch (error) {
      log.warn("Semantic mapping skipped", { reason: error instanceof Error ? error.name : "unknown" });
      warnings.push("Semantic mapping could not be completed. Explicit numbers were still mapped; remaining items need review.");
    }
  }

  const unanswered = unansweredMappings(questions, explicit.mappedQuestionIds);
  const mappedAnswers = markUnmatchedAnswers(answers, explicit.mappedAnswerIds);

  log.info("Mapping completed", {
    mapped: explicit.mappings.length + semantic.length,
    unanswered: unanswered.length,
  });

  return {
    mappings: [...explicit.mappings, ...semantic, ...unanswered],
    answers: mappedAnswers,
    warnings,
  };
}
