import { fromNormalizedFractions, isReliableRegion } from "@/lib/coordinates";
import { HIGH_CONFIDENCE } from "@/lib/constants";
import { uniqueId } from "@/lib/utils";
import type {
  Answer,
  AssessmentResult,
  AssessmentSummary,
  DocumentMeta,
  Grade,
  Mapping,
  Question,
} from "@/types/assessment";

export function validateQuestions(questions: Question[], pageCount: number): Question[] {
  const seen = new Set<string>();
  return questions.map((question, index) => {
    let status = question.status;
    let reviewReason = question.reviewReason;
    if (seen.has(question.normalizedNumber)) {
      status = "review_required";
      reviewReason = "Duplicate question number detected.";
    }
    seen.add(question.normalizedNumber);
    if (question.page < 1 || question.page > pageCount) {
      status = "review_required";
      reviewReason = "Question page is outside the document range.";
    }
    if (question.confidence < HIGH_CONFIDENCE) {
      status = "review_required";
      reviewReason = reviewReason ?? "Low extraction confidence.";
    }
    if (!question.text.trim()) {
      status = "review_required";
      reviewReason = "Question text is empty.";
    }
    return {
      ...question,
      id: question.id || `q_${index + 1}`,
      status,
      reviewReason,
    };
  });
}

export function validateAnswers(answers: Answer[], pageCount: number): Answer[] {
  return answers.map((answer) => {
    const regions = answer.regions
      .filter((region) => region.page >= 1 && region.page <= pageCount)
      .map((region) => {
        const normalized = fromNormalizedFractions(region);
        return { ...normalized, reliable: isReliableRegion(normalized) };
      });

    const hasReliableRegion = regions.some((region) => region.reliable);
    let status = answer.status;
    let reviewReason = answer.reviewReason;

    if (answer.confidence < HIGH_CONFIDENCE) {
      status = status === "unmatched" ? status : "review_required";
      reviewReason = reviewReason ?? "Low answer extraction confidence.";
    }
    if (!answer.text.trim() && status !== "unmatched") {
      status = "review_required";
      reviewReason = "Answer text could not be read confidently.";
    }
    if (regions.length > 0 && !hasReliableRegion) {
      status = "review_required";
      reviewReason = "Unable to reliably determine answer region.";
    }

    return {
      ...answer,
      regions: hasReliableRegion ? regions.filter((region) => region.reliable) : [],
      status,
      reviewReason,
    };
  });
}

export function detectDuplicateMappings(mappings: Mapping[]): Mapping[] {
  const byQuestion = new Map<string, Mapping[]>();
  const byAnswer = new Map<string, Mapping[]>();

  for (const mapping of mappings) {
    if (mapping.status === "unanswered") continue;
    const questionGroup = byQuestion.get(mapping.questionId) ?? [];
    questionGroup.push(mapping);
    byQuestion.set(mapping.questionId, questionGroup);
    if (mapping.answerId) {
      const answerGroup = byAnswer.get(mapping.answerId) ?? [];
      answerGroup.push(mapping);
      byAnswer.set(mapping.answerId, answerGroup);
    }
  }

  const conflictIds = new Set<string>();
  for (const group of byQuestion.values()) {
    if (group.length > 1) group.forEach((item) => conflictIds.add(item.id));
  }
  for (const group of byAnswer.values()) {
    if (group.length > 1) group.forEach((item) => conflictIds.add(item.id));
  }

  return mappings.map((mapping) =>
    conflictIds.has(mapping.id)
      ? {
          ...mapping,
          status: "conflict" as const,
          reviewReason: mapping.reviewReason ?? "Duplicate mapping detected.",
        }
      : mapping,
  );
}

export function buildSummary(
  questions: Question[],
  answers: Answer[],
  mappings: Mapping[],
  grades: Grade[],
): AssessmentSummary {
  const unanswered = mappings.filter((mapping) => mapping.status === "unanswered").length;
  const reviewIds = new Set<string>();
  for (const question of questions) {
    if (question.status === "review_required") reviewIds.add(question.id);
  }
  for (const mapping of mappings) {
    if (mapping.status === "review_required" || mapping.status === "conflict") {
      reviewIds.add(mapping.questionId);
    }
  }
  const reviewRequired = reviewIds.size;
  const mappedQuestionIds = new Set(
    mappings.filter((mapping) => mapping.answerId && mapping.status !== "unanswered").map((item) => item.questionId),
  );
  const unmatchedAnswers = answers.filter((answer) => answer.status === "unmatched").length;
  const conflicts = mappings.filter((mapping) => mapping.status === "conflict").length;

  const usableGrades = grades.filter(
    (grade) => grade.score !== null && grade.maxMarks !== null && grade.status === "valid",
  );
  const score = usableGrades.length
    ? usableGrades.reduce((sum, grade) => sum + (grade.score ?? 0), 0)
    : null;
  const maxScore = usableGrades.length
    ? usableGrades.reduce((sum, grade) => sum + (grade.maxMarks ?? 0), 0)
    : null;
  const allMappedHaveMarks =
    mappedQuestionIds.size > 0 &&
    [...mappedQuestionIds].every((questionId) =>
      usableGrades.some((grade) => grade.questionId === questionId),
    );

  return {
    totalQuestions: questions.length,
    answered: mappedQuestionIds.size,
    unanswered,
    reviewRequired,
    unmappedAnswers: unmatchedAnswers,
    conflicts,
    score: allMappedHaveMarks ? score : null,
    maxScore: allMappedHaveMarks ? maxScore : null,
    percentage:
      allMappedHaveMarks && score !== null && maxScore
        ? Math.round((score / maxScore) * 1000) / 10
        : null,
  };
}

export function ensureMappingCoverage(questions: Question[], mappings: Mapping[]): Mapping[] {
  const covered = new Set(mappings.map((mapping) => mapping.questionId));
  const missing = questions
    .filter((question) => !covered.has(question.id))
    .map((question) => ({
      id: uniqueId("map"),
      questionId: question.id,
      answerId: null,
      confidence: 0,
      status: "unanswered" as const,
      method: "none" as const,
      reviewReason: "No answer was mapped to this question.",
    }));
  return [...mappings, ...missing];
}

export function finalizeAssessment(result: Omit<AssessmentResult, "summary" | "unmatchedAnswers">): AssessmentResult {
  const mappings = detectDuplicateMappings(ensureMappingCoverage(result.questions, result.mappings));
  const unmatchedAnswers = result.answers.filter((answer) => {
    const used = mappings.some((mapping) => mapping.answerId === answer.id && mapping.status !== "unanswered");
    return answer.status === "unmatched" || !used;
  });
  const answers = result.answers.map((answer) =>
    unmatchedAnswers.some((item) => item.id === answer.id)
      ? {
          ...answer,
          status: "unmatched" as const,
          reviewReason: answer.reviewReason ?? "Unable to confidently associate this answer with a question.",
        }
      : answer,
  );

  return {
    ...result,
    answers,
    mappings,
    unmatchedAnswers: answers.filter((answer) => answer.status === "unmatched"),
    summary: buildSummary(result.questions, answers, mappings, result.grades),
  };
}

export function applyManualMapping(
  result: AssessmentResult,
  questionId: string,
  answerId: string | null,
): AssessmentResult {
  const mappings = result.mappings.map((mapping) => {
    if (mapping.questionId !== questionId) {
      if (answerId && mapping.answerId === answerId) {
        return {
          ...mapping,
          answerId: null,
          status: "unanswered" as const,
          method: "manual" as const,
          confidence: 1,
          reviewReason: "Cleared because the answer was reassigned.",
        };
      }
      return mapping;
    }
    if (!answerId) {
      return {
        ...mapping,
        answerId: null,
        status: "unanswered" as const,
        method: "manual" as const,
        confidence: 1,
        reviewReason: undefined,
      };
    }
    return {
      ...mapping,
      answerId,
      status: "mapped" as const,
      method: "manual" as const,
      confidence: 1,
      reviewReason: undefined,
    };
  });

  const usedAnswerIds = new Set(
    mappings.filter((mapping) => mapping.answerId).map((mapping) => mapping.answerId as string),
  );
  const answers: Answer[] = result.answers.map((answer) => {
    if (usedAnswerIds.has(answer.id)) {
      return {
        ...answer,
        status: answer.status === "unmatched" ? "valid" : answer.status,
      };
    }
    return { ...answer, status: "unmatched" };
  });

  return finalizeAssessment({
    ...result,
    answers,
    mappings,
    grades: result.grades,
    processingMetadata: result.processingMetadata,
  });
}

export function confirmMapping(result: AssessmentResult, questionId: string): AssessmentResult {
  const mappings = result.mappings.map((mapping) =>
    mapping.questionId === questionId && mapping.answerId
      ? { ...mapping, status: "mapped" as const, method: "manual" as const, confidence: 1, reviewReason: undefined }
      : mapping,
  );
  return finalizeAssessment({
    ...result,
    mappings,
    grades: result.grades,
    processingMetadata: result.processingMetadata,
  });
}

export function findPage(meta: DocumentMeta, page: number) {
  return meta.pages.find((item) => item.page === page);
}
