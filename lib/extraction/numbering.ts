const PREFIX = /^(?:question|ques|que|qstn|q|ans(?:wer)?|no)\s*[.:)\-]?\s*/i;
const SURROUNDING = /[\s.:)\-]+/g;

export function normalizeQuestionNumber(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(PREFIX, "");
  value = value.replace(SURROUNDING, "");
  value = value.replace(/[\[\{]/g, "(").replace(/[\]\}]/g, ")");
  value = value.replace(/[–—]/g, "-");

  const withPart = value.match(/^(\d+)\(?([a-z])\)?$/);
  if (withPart) {
    return `${withPart[1]}(${withPart[2]})`;
  }

  const dashed = value.match(/^(\d+)-([a-z])$/);
  if (dashed) {
    return `${dashed[1]}(${dashed[2]})`;
  }

  const numeric = value.match(/^(\d+)$/);
  if (numeric) {
    return numeric[1];
  }

  const nested = value.match(/^(\d+)\(([a-z])\)(?:\(([ivxlcdm]+)\))?$/);
  if (nested) {
    return nested[3] ? `${nested[1]}(${nested[2]})(${nested[3]})` : `${nested[1]}(${nested[2]})`;
  }

  return value;
}

export function displayQuestionNumber(raw: string): string {
  const normalized = normalizeQuestionNumber(raw);
  const match = normalized.match(/^(\d+)\(([a-z])\)$/);
  if (match) return `${match[1]} (${match[2]})`;
  return normalized || raw.trim();
}

export function questionIdFromNumber(normalizedNumber: string): string {
  const safe = normalizedNumber.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return `q_${safe || "unknown"}`;
}

export function extractQuestionReference(text: string): string | undefined {
  const patterns = [
    /\b(?:answer|ans)\s*[:.\-]?\s*(?:q(?:uestion)?\.?\s*)?(\d+\s*[\(\-]?\s*[a-z]?\s*\)?)/i,
    /\b(?:question|ques|q)\s*[.:)\-]?\s*(\d+\s*[\(\-]?\s*[a-z]?\s*\)?)/i,
    /^\s*(\d+\s*[\(\-]?\s*[a-z]\s*\)?)\s*[.):\-]/im,
    /^\s*(\d+)\s*[.)]\s+/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const normalized = normalizeQuestionNumber(match[1]);
      if (normalized) return normalized;
    }
  }
  return undefined;
}

export function numbersMatch(a: string, b: string): boolean {
  return normalizeQuestionNumber(a) === normalizeQuestionNumber(b);
}
