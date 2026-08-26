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
    if (matches.length === 1 && !mappedAnswerIds.has(answer.id)) {
      const question = matches[0];
      const alreadyMapped = mappedQuestionIds.has(question.id);
      const lowConfidence = answer.confidence < HIGH_CONFIDENCE;
      mappings.push({
        id: uniqueId("map"),
        questionId: question.id,
        answerId: answer.id,
        confidence: answer.confidence,
        status: alreadyMapped ? "conflict" : lowConfidence ? "review_required" : "mapped",
        method: "explicit",
        reviewReason: alreadyMapped
          ? "Another answer is already mapped to this question number."
          : lowConfidence
            ? "Explicit number found but answer extraction confidence is low."
            : undefined,
      });
      mappedAnswerIds.add(answer.id);
      mappedQuestionIds.add(question.id);
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
    const continued =
      Boolean(answer.continuedFromPrevious) || answer.text.toLowerCase().includes("continued");
    const sequentialPage =
      Boolean(previous) &&
      answer.regions[0]?.page === (previous?.regions.at(-1)?.page ?? 0) + 1;

    if (previous && (sameRef || (continued && sequentialPage))) {
      previous.text = `${previous.text}\n${answer.text}`.trim();
      previous.regions = [...previous.regions, ...answer.regions];
      previous.confidence = Math.min(previous.confidence, answer.confidence);
      continue;
    }
    merged.push({ ...answer, regions: [...answer.regions] });
  }
  return merged;
}
