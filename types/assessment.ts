export type ExtractionStatus = "valid" | "review_required";
export type AnswerStatus = "valid" | "review_required" | "unmatched";
export type MappingStatus =
  | "mapped"
  | "unanswered"
  | "review_required"
  | "conflict";
export type ConfidenceLevel = "high" | "review_required" | "failed";
export type CoordinateSystem = "pdf" | "image" | "normalized";
export type DocumentKind = "question_paper" | "answer_sheet";
export type SupportedMime = "application/pdf" | "image/png" | "image/jpeg";

export type ProcessingStage =
  | "idle"
  | "uploading"
  | "preprocessing"
  | "extracting_questions"
  | "extracting_answers"
  | "mapping_answers"
  | "validating"
  | "grading"
  | "completed"
  | "failed";

export type ProcessingStepStatus = "pending" | "processing" | "completed" | "failed";

export interface ProcessingStep {
  id: string;
  label: string;
  status: ProcessingStepStatus;
  detail?: string;
}

export interface PageInfo {
  page: number;
  width: number;
  height: number;
  rotation: number;
  blank: boolean;
}

export interface DocumentMeta {
  kind: DocumentKind;
  filename: string;
  mime: SupportedMime;
  sizeBytes: number;
  pageCount: number;
  pages: PageInfo[];
}

export interface PaperSection {
  id: string;
  label?: string;
  attemptAny: number;
  marksPerQuestion: number;
  sectionTotal: number;
  questionIds: string[];
}

export interface PaperScheme {
  paperMaxMarks: number | null;
  sections: PaperSection[];
}

export interface Question {
  id: string;
  number: string;
  displayNumber: string;
  normalizedNumber: string;
  text: string;
  page: number;
  maxMarks: number | null;
  confidence: number;
  status: ExtractionStatus;
  reviewReason?: string;
}

export interface AnswerRegion {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  coordinateSystem: CoordinateSystem;
  reliable: boolean;
}

export interface Answer {
  id: string;
  questionReference?: string;
  text: string;
  regions: AnswerRegion[];
  confidence: number;
  status: AnswerStatus;
  reviewReason?: string;
  continuedFromPrevious?: boolean;
}

export interface Mapping {
  id: string;
  questionId: string;
  answerId?: string | null;
  confidence: number;
  status: MappingStatus;
  method: "explicit" | "semantic" | "manual" | "none";
  reviewReason?: string;
}

export interface Grade {
  questionId: string;
  answerId: string;
  score: number | null;
  maxMarks: number | null;
  correctness: "correct" | "partial" | "incorrect" | "unavailable";
  feedback: string;
  confidence: number;
  status: ExtractionStatus;
}

export interface AssessmentSummary {
  totalQuestions: number;
  answered: number;
  unanswered: number;
  reviewRequired: number;
  unmappedAnswers: number;
  conflicts: number;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  aiSummary?: string;
}

export interface ProcessingMetadata {
  isDemo: boolean;
  model: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  warnings: string[];
  questionDocument: DocumentMeta;
  answerDocument: DocumentMeta;
}

export interface AssessmentResult {
  questions: Question[];
  answers: Answer[];
  mappings: Mapping[];
  unmatchedAnswers: Answer[];
  grades: Grade[];
  summary: AssessmentSummary;
  paperScheme?: PaperScheme | null;
  processingMetadata: ProcessingMetadata;
}

export interface ProgressEvent {
  type: "progress";
  stage: ProcessingStage;
  message: string;
  steps: ProcessingStep[];
}

export interface CompleteEvent {
  type: "complete";
  assessment: AssessmentResult;
}

export interface ErrorEvent {
  type: "error";
  code: string;
  message: string;
  retryable: boolean;
}

export type StreamEvent = ProgressEvent | CompleteEvent | ErrorEvent;
