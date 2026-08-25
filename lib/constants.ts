import type { ProcessingStep } from "@/types/assessment";

export const APP_NAME = "VedaAI";
export const TEACHER_NAME = "Madhur Rastogi";
export const SCHOOL_NAME = "Delhi Public School, Bokaro Steel City";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 30;
export const MIN_PAGES = 1;

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"] as const;
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const HIGH_CONFIDENCE = 0.8;
export const REVIEW_CONFIDENCE = 0.55;

export const DEFAULT_MODEL = "gemini-2.5-flash";
export const FALLBACK_MODEL = "gemini-2.0-flash";

export const INITIAL_STEPS: ProcessingStep[] = [
  { id: "question_upload", label: "Question Paper", status: "pending" },
  { id: "question_extraction", label: "Question Extraction", status: "pending" },
  { id: "answer_upload", label: "Answer Sheet", status: "pending" },
  { id: "preprocessing", label: "Document Processing", status: "pending" },
  { id: "answer_extraction", label: "Handwritten Answer Extraction", status: "pending" },
  { id: "mapping", label: "Answer Mapping", status: "pending" },
  { id: "assessment", label: "Assessment Analysis", status: "pending" },
];
