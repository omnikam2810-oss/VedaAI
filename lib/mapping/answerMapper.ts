import { HIGH_CONFIDENCE, REVIEW_CONFIDENCE } from "@/lib/constants";
import { extractQuestionReference, normalizeQuestionNumber, numbersMatch } from "@/lib/extraction/numbering";
import { uniqueId } from "@/lib/utils";
import type { Answer, Mapping, Question } from "@/types/assessment";

export interface SemanticMatch {
  questionId: string;
  answerId: string;
  confidence: number;
  reason?: string;
}

export function explicitMap(questions: Question[], answers: Answer[]): {
  mappings: Mapping[];
  mappedAnswerIds: Set<string>;
  mappedQuestionIds: Set<string>;
} {
  const mappings: Mapping[] = [];
  const mappedAnswerIds = new Set<string>();
  const mappedQuestionIds = new Set<string>();

  for (const answer of answers) {
    const reference = answer.questionReference || extractQuestionReference(answer.text);
    if (!reference) continue;
    const matches = questions.filter((question) => numbersMatch(question.normalizedNumber, reference));
    if (matches.length === 1 && !mappedQuestionIds.has(matches[0].id) && !mappedAnswerIds.has(answer.id)) {
      mappings.push({
        id: uniqueId("map"),
        questionId: matches[0].id,
        answerId: answer.id,
        confidence: Math.max(answer.confidence, 0.9),
        status: answer.confidence >= HIGH_CONFIDENCE ? "mapped" : "review_required",
        method: "explicit",
        reviewReason:
          answer.confidence >= HIGH_CONFIDENCE
            ? undefined
            : "Explicit number found but answer extraction confidence is low.",
      });
      mappedAnswerIds.add(answer.id);
      mappedQuestionIds.add(matches[0].id);
    } else if (matches.length > 1) {
      mappings.push({
        id: uniqueId("map"),
        questionId: matches[0].id,
        answerId: answer.id,
        confidence: 0.5,
        status: "review_required",
        method: "explicit",
        reviewReason: "Question number matched more than one extracted question.",
      });
    }
  }

  return { mappings, mappedAnswerIds, mappedQuestionIds };
}

export function applySemanticMatches(
  questions: Question[],
  answers: Answer[],
  matches: SemanticMatch[],
  mappedAnswerIds: Set<string>,
  mappedQuestionIds: Set<string>,
): Mapping[] {
  const mappings: Mapping[] = [];

  const sorted = [...matches].sort((a, b) => b.confidence - a.confidence);
  for (const match of sorted) {
    if (mappedAnswerIds.has(match.answerId) || mappedQuestionIds.has(match.questionId)) continue;
    const question = questions.find((item) => item.id === match.questionId);
    const answer = answers.find((item) => item.id === match.answerId);
    if (!question || !answer) continue;

    let status: Mapping["status"] = "mapped";
    let reviewReason: string | undefined;
    if (match.confidence < REVIEW_CONFIDENCE) {
      continue;
    }
    if (match.confidence < HIGH_CONFIDENCE) {
      status = "review_required";
      reviewReason = match.reason || "Semantic mapping confidence is below the high-confidence threshold.";
    }

    mappings.push({
      id: uniqueId("map"),
      questionId: question.id,
      answerId: answer.id,
      confidence: match.confidence,
      status,
      method: "semantic",
      reviewReason,
    });
    mappedAnswerIds.add(answer.id);
    mappedQuestionIds.add(question.id);
  }

  return mappings;
}

export function unansweredMappings(questions: Question[], mappedQuestionIds: Set<string>): Mapping[] {
  return questions
    .filter((question) => !mappedQuestionIds.has(question.id))
    .map((question) => ({
      id: uniqueId("map"),
      questionId: question.id,
      answerId: null,
      confidence: 0,
      status: "unanswered" as const,
      method: "none" as const,
      reviewReason: "No answer detected for this question.",
    }));
}

export function markUnmatchedAnswers(answers: Answer[], mappedAnswerIds: Set<string>): Answer[] {
  return answers.map((answer) =>
    mappedAnswerIds.has(answer.id)
      ? answer
      : {
          ...answer,
          status: "unmatched",
          reviewReason: answer.reviewReason ?? "Unable to confidently associate this answer with a question.",
        },
  );
}

export function mergeContinuedAnswers(answers: Answer[]): Answer[] {
  const merged: Answer[] = [];
  for (const answer of answers) {
    const previous = merged[merged.length - 1];
    const sameRef =
      previous &&
      previous.questionReference &&
      answer.questionReference &&
      normalizeQuestionNumber(previous.questionReference) ===
        normalizeQuestionNumber(answer.questionReference);
    const continued = Boolean(
      answer.text.toLowerCase().includes("continued") ||
        previous?.questionReference && !answer.questionReference && answer.regions[0]?.page === (previous.regions.at(-1)?.page ?? 0) + 1,
    );

    if (previous && (sameRef || continued) && previous.questionReference) {
      previous.text = `${previous.text}\n${answer.text}`.trim();
      previous.regions = [...previous.regions, ...answer.regions];
      previous.confidence = Math.min(previous.confidence, answer.confidence);
      continue;
    }
    merged.push({ ...answer, regions: [...answer.regions] });
  }
  return merged;
}
