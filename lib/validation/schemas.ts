import { z } from "zod";

export const confidenceSchema = z.number().min(0).max(1);

export const aiQuestionSchema = z.object({
  number: z.string().min(1),
  text: z.string().min(1),
  page: z.number().int().positive(),
  maxMarks: z.number().positive().nullable().optional(),
  confidence: confidenceSchema,
  ambiguous: z.boolean().optional(),
  reviewReason: z.string().optional(),
});

export const aiPaperSectionSchema = z.object({
  label: z.string().optional(),
  attemptAny: z.number().int().positive(),
  marksPerQuestion: z.number().positive(),
  sectionTotal: z.number().positive(),
  questionNumbers: z.array(z.string().min(1)).min(1),
});

export const aiQuestionExtractionSchema = z.object({
  paperMaxMarks: z.number().positive().nullable().optional(),
  sections: z.array(aiPaperSectionSchema).optional(),
  questions: z.array(aiQuestionSchema),
  warnings: z.array(z.string()).optional(),
});

export const aiRegionSchema = z.object({
  page: z.number().int().positive(),
  normalizedX: z.number().min(0).max(1),
  normalizedY: z.number().min(0).max(1),
  normalizedWidth: z.number().min(0).max(1),
  normalizedHeight: z.number().min(0).max(1),
  reliable: z.boolean().optional(),
});

export const aiAnswerSchema = z.object({
  questionReference: z.string().nullable().optional(),
  text: z.string(),
  regions: z.array(aiRegionSchema).default([]),
  confidence: confidenceSchema,
  unreadable: z.boolean().optional(),
  reviewReason: z.string().optional(),
  continuedFromPrevious: z.boolean().optional(),
});

export const aiAnswerExtractionSchema = z.object({
  answers: z.array(aiAnswerSchema),
  warnings: z.array(z.string()).optional(),
});

export const aiSemanticMatchSchema = z.object({
  questionNumber: z.string(),
  answerIndex: z.number().int().nonnegative(),
  confidence: confidenceSchema,
  reason: z.string().optional(),
});

export const aiSemanticMappingSchema = z.object({
  matches: z.array(aiSemanticMatchSchema),
  unmatchedAnswerIndexes: z.array(z.number().int().nonnegative()).optional(),
  warnings: z.array(z.string()).optional(),
});

export const aiGradeSchema = z.object({
  questionNumber: z.string(),
  score: z.number().min(0).nullable(),
  maxMarks: z.number().positive().nullable(),
  correctness: z.enum(["correct", "partial", "incorrect", "unavailable"]),
  feedback: z.string(),
  confidence: confidenceSchema,
  reviewRequired: z.boolean().optional(),
});

export const aiGradingSchema = z.object({
  grades: z.array(aiGradeSchema),
  summary: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

export type AiQuestionExtraction = z.infer<typeof aiQuestionExtractionSchema>;
export type AiAnswerExtraction = z.infer<typeof aiAnswerExtractionSchema>;
export type AiSemanticMapping = z.infer<typeof aiSemanticMappingSchema>;
export type AiGrading = z.infer<typeof aiGradingSchema>;
