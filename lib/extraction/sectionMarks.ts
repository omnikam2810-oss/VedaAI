import type { Grade, Mapping, PaperScheme, PaperSection, Question } from "@/types/assessment";

/** Parse printed schemes like 5 × 4 = 20 into marks per question (the second factor). */
export function marksPerQuestionFromFormula(text: string): number | null {
  return parseSectionFormula(text)?.marksPerQuestion ?? null;
}

export function parseSectionFormula(text: string): {
  attemptAny: number;
  marksPerQuestion: number;
  sectionTotal: number;
} | null {
  const match = text.match(/(\d+)\s*[×xX*]\s*(\d+)\s*=\s*(\d+)/);
  if (!match) return null;
  const attemptAny = Number(match[1]);
  const marksPerQuestion = Number(match[2]);
  const sectionTotal = Number(match[3]);
  if (![attemptAny, marksPerQuestion, sectionTotal].every(Number.isFinite)) return null;
  if (attemptAny < 1 || marksPerQuestion < 1) return null;
  if (attemptAny * marksPerQuestion !== sectionTotal) return null;
  return { attemptAny, marksPerQuestion, sectionTotal };
}

export function parsePaperMaxMarks(text: string): number | null {
  const match = text.match(/(?:M\.?\s*M\.?|Maximum\s*Marks|Max\.?\s*Marks)\s*[:.\-]?\s*(\d{1,3})\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isUnanswered(mapping: Mapping | undefined): boolean {
  return !mapping || mapping.status === "unanswered" || !mapping.answerId;
}

function validScore(grade: Grade | undefined): number | null {
  if (!grade || grade.status !== "valid" || grade.score === null) return null;
  return grade.score;
}

function sectionOutOf(section: PaperSection): number | null {
  if (section.attemptAny < 1 || section.marksPerQuestion < 1) return null;
  const expected = section.attemptAny * section.marksPerQuestion;
  if (section.sectionTotal !== expected) return null;
  return section.sectionTotal;
}

/** Score against printed paper/section totals so internal-choice extras are not added to the maximum. */
export function computePaperMarks(input: {
  questions: Question[];
  mappings: Mapping[];
  grades: Grade[];
  scheme?: PaperScheme | null;
}): { awarded: number; outOf: number; unansweredWithoutMarks: number } | null {
  const hasNumericGrade = input.grades.some(
    (grade) => grade.score !== null && grade.maxMarks !== null && grade.status === "valid",
  );
  if (!hasNumericGrade) return null;

  const mappingByQuestion = new Map(input.mappings.map((mapping) => [mapping.questionId, mapping]));
  const gradeByQuestion = new Map(input.grades.map((grade) => [grade.questionId, grade]));
  const scheme = input.scheme;
  const sections = (scheme?.sections ?? []).filter((section) => sectionOutOf(section) !== null);

  if (sections.length) {
    let awarded = 0;
    let outOf = 0;
    const sectioned = new Set<string>();

    for (const section of sections) {
      const max = sectionOutOf(section);
      if (max === null) continue;
      const scores: number[] = [];
      for (const questionId of section.questionIds) {
        sectioned.add(questionId);
        if (isUnanswered(mappingByQuestion.get(questionId))) continue;
        const score = validScore(gradeByQuestion.get(questionId));
        if (score !== null) scores.push(score);
      }
      scores.sort((left, right) => right - left);
      awarded += scores.slice(0, section.attemptAny).reduce((sum, score) => sum + score, 0);
      outOf += max;
    }

    for (const question of input.questions) {
      if (sectioned.has(question.id)) continue;
      const maxMarks = question.maxMarks ?? gradeByQuestion.get(question.id)?.maxMarks ?? null;
      if (maxMarks === null) continue;
      outOf += maxMarks;
      if (isUnanswered(mappingByQuestion.get(question.id))) continue;
      const score = validScore(gradeByQuestion.get(question.id));
      if (score !== null) awarded += score;
    }

    const paperMax = scheme?.paperMaxMarks;
    if (paperMax && paperMax > 0) outOf = paperMax;
    return { awarded: Math.min(awarded, outOf), outOf, unansweredWithoutMarks: 0 };
  }

  if (scheme?.paperMaxMarks && scheme.paperMaxMarks > 0) {
    let awarded = 0;
    for (const question of input.questions) {
      if (isUnanswered(mappingByQuestion.get(question.id))) continue;
      const score = validScore(gradeByQuestion.get(question.id));
      if (score !== null) awarded += score;
    }
    const outOf = scheme.paperMaxMarks;
    return { awarded: Math.min(awarded, outOf), outOf, unansweredWithoutMarks: 0 };
  }

  let awarded = 0;
  let outOf = 0;
  let unansweredWithoutMarks = 0;
  for (const question of input.questions) {
    const unanswered = isUnanswered(mappingByQuestion.get(question.id));
    const grade = gradeByQuestion.get(question.id);
    const maxMarks = question.maxMarks ?? grade?.maxMarks ?? null;
    if (maxMarks === null) {
      if (unanswered) unansweredWithoutMarks += 1;
      continue;
    }
    outOf += maxMarks;
    if (unanswered) continue;
    const score = validScore(grade);
    if (score !== null) awarded += score;
  }
  if (outOf <= 0) return null;
  return { awarded, outOf, unansweredWithoutMarks };
}
