/** Parse printed schemes like 5 × 4 = 20 into marks per question (the second factor). */
export function marksPerQuestionFromFormula(text: string): number | null {
  const match = text.match(/(\d+)\s*[×xX*]\s*(\d+)\s*=\s*(\d+)/);
  if (!match) return null;
  const attempted = Number(match[1]);
  const perQuestion = Number(match[2]);
  const total = Number(match[3]);
  if (![attempted, perQuestion, total].every(Number.isFinite)) return null;
  if (attempted < 1 || perQuestion < 1) return null;
  if (attempted * perQuestion !== total) return null;
  return perQuestion;
}
