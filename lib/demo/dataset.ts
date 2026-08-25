import { fromNormalizedFractions } from "@/lib/coordinates";
import { finalizeAssessment } from "@/lib/validation/business";
import type { Answer, AssessmentResult, Grade, Mapping, Question } from "@/types/assessment";

function region(page: number, x: number, y: number, width: number, height: number) {
  return fromNormalizedFractions({
    page,
    normalizedX: x,
    normalizedY: y,
    normalizedWidth: width,
    normalizedHeight: height,
    pageWidth: 595,
    pageHeight: 842,
  });
}

const questions: Question[] = [
  {
    id: "q_1",
    number: "1",
    displayNumber: "1",
    normalizedNumber: "1",
    text: "Which blood vessel carries blood away from the heart?",
    page: 1,
    maxMarks: 2,
    confidence: 0.98,
    status: "valid",
  },
  {
    id: "q_2",
    number: "2",
    displayNumber: "2",
    normalizedNumber: "2",
    text: "Describe the process of photosynthesis. Mention the site where it occurs.",
    page: 1,
    maxMarks: 5,
    confidence: 0.97,
    status: "valid",
  },
  {
    id: "q_3",
    number: "3",
    displayNumber: "3",
    normalizedNumber: "3",
    text: "Explain the function of stomata in plants.",
    page: 1,
    maxMarks: 3,
    confidence: 0.96,
    status: "valid",
  },
  {
    id: "q_4",
    number: "4",
    displayNumber: "4",
    normalizedNumber: "4",
    text: "What is the role of chlorophyll in photosynthesis?",
    page: 1,
    maxMarks: 2,
    confidence: 0.97,
    status: "valid",
  },
  {
    id: "q_5",
    number: "5",
    displayNumber: "5",
    normalizedNumber: "5",
    text: "Draw a labelled diagram showing the process of photosynthesis in a plant.",
    page: 1,
    maxMarks: 5,
    confidence: 0.95,
    status: "valid",
  },
  {
    id: "q_6",
    number: "6",
    displayNumber: "6",
    normalizedNumber: "6",
    text: "Differentiate between aerobic and anaerobic respiration.",
    page: 1,
    maxMarks: 4,
    confidence: 0.96,
    status: "valid",
  },
  {
    id: "q_7_a",
    number: "7(a)",
    displayNumber: "7 (a)",
    normalizedNumber: "7(a)",
    text: "Define transpiration.",
    page: 2,
    maxMarks: 2,
    confidence: 0.94,
    status: "valid",
  },
  {
    id: "q_7_b",
    number: "7(b)",
    displayNumber: "7 (b)",
    normalizedNumber: "7(b)",
    text: "List two factors that affect the rate of transpiration.",
    page: 2,
    maxMarks: 3,
    confidence: 0.93,
    status: "valid",
  },
  {
    id: "q_8",
    number: "8",
    displayNumber: "8",
    normalizedNumber: "8",
    text: "Why is the small intestine considered the site of complete digestion?",
    page: 2,
    maxMarks: 4,
    confidence: 0.95,
    status: "valid",
  },
];

const answers: Answer[] = [
  {
    id: "answer_005",
    questionReference: "5",
    text: "Q5. Diagram of a plant showing photosynthesis. Sunlight falls on the leaf. Carbon dioxide enters, water is absorbed by roots, oxygen is released. The process mainly occurs in the chloroplast of the plant cell.",
    regions: [region(1, 0.08, 0.1, 0.84, 0.32)],
    confidence: 0.92,
    status: "valid",
  },
  {
    id: "answer_002",
    questionReference: "2",
    text: "Q2. The process mainly occurs in the chloroplast of the plant cell. Green plants make food using sunlight, carbon dioxide and water. Chlorophyll traps light energy. Glucose is produced and oxygen is released. 6CO2 + 6H2O → C6H12O6 + 6O2. Continued on next page.",
    regions: [region(1, 0.08, 0.46, 0.84, 0.4), region(2, 0.08, 0.1, 0.84, 0.3)],
    confidence: 0.94,
    status: "valid",
  },
  {
    id: "answer_001",
    questionReference: "1",
    text: "Q1. Arteries carry blood away from the heart. They have thick walls to withstand high pressure.",
    regions: [region(2, 0.08, 0.46, 0.84, 0.2)],
    confidence: 0.96,
    status: "valid",
  },
  {
    id: "answer_007a",
    questionReference: "7(a)",
    text: "Ans 7(a): Transpiration is the loss of water vapour from the aerial parts of a plant, mainly through stomata.",
    regions: [region(3, 0.08, 0.1, 0.84, 0.18)],
    confidence: 0.93,
    status: "valid",
  },
  {
    id: "answer_006",
    questionReference: "6",
    text: "Q6. Aerobic respiration uses oxygen and produces more energy. Anaerobic respiration occurs without oxygen and produces lactic acid or alcohol with less energy.",
    regions: [region(3, 0.08, 0.34, 0.84, 0.22)],
    confidence: 0.9,
    status: "valid",
  },
  {
    id: "answer_unmapped",
    text: "Yesterday our school cricket team won the match by 4 wickets. Virat scored 62 runs.",
    regions: [region(3, 0.08, 0.64, 0.84, 0.18)],
    confidence: 0.88,
    status: "unmatched",
    reviewReason: "Unable to confidently associate this answer with a question.",
  },
  {
    id: "answer_007b",
    questionReference: "7(b)",
    text: "temperature and wind maybe humidity also I think",
    regions: [region(4, 0.08, 0.1, 0.84, 0.22)],
    confidence: 0.58,
    status: "review_required",
    reviewReason: "Handwriting is unclear and the mapping confidence is low.",
  },
  {
    id: "answer_003",
    questionReference: "3",
    text: "Q3. Stomata are tiny pores on the leaf. They allow exchange of CO2 and O2 and also help in transpiration.",
    regions: [region(4, 0.08, 0.4, 0.84, 0.22)],
    confidence: 0.91,
    status: "valid",
  },
  {
    id: "answer_008",
    questionReference: "8",
    text: "Q8. Complete digestion happens in the small intestine because it has enzymes from pancreas and bile from liver, and villi absorb nutrients.",
    regions: [region(4, 0.08, 0.68, 0.84, 0.2)],
    confidence: 0.89,
    status: "valid",
  },
];

const mappings: Mapping[] = [
  { id: "map_1", questionId: "q_1", answerId: "answer_001", confidence: 0.96, status: "mapped", method: "explicit" },
  { id: "map_2", questionId: "q_2", answerId: "answer_002", confidence: 0.94, status: "mapped", method: "explicit" },
  { id: "map_3", questionId: "q_3", answerId: "answer_003", confidence: 0.91, status: "mapped", method: "explicit" },
  {
    id: "map_4",
    questionId: "q_4",
    answerId: null,
    confidence: 0,
    status: "unanswered",
    method: "none",
    reviewReason: "No answer detected for this question.",
  },
  { id: "map_5", questionId: "q_5", answerId: "answer_005", confidence: 0.92, status: "mapped", method: "explicit" },
  { id: "map_6", questionId: "q_6", answerId: "answer_006", confidence: 0.9, status: "mapped", method: "explicit" },
  { id: "map_7a", questionId: "q_7_a", answerId: "answer_007a", confidence: 0.93, status: "mapped", method: "explicit" },
  {
    id: "map_7b",
    questionId: "q_7_b",
    answerId: "answer_007b",
    confidence: 0.58,
    status: "review_required",
    method: "semantic",
    reviewReason: "Possible match: 7(b). Confidence is 58%. Teacher review required.",
  },
  { id: "map_8", questionId: "q_8", answerId: "answer_008", confidence: 0.89, status: "mapped", method: "explicit" },
];

const grades: Grade[] = [
  { questionId: "q_1", answerId: "answer_001", score: 2, maxMarks: 2, correctness: "correct", feedback: "Correctly identifies arteries as the vessels that carry blood away from the heart.", confidence: 0.95, status: "valid" },
  { questionId: "q_2", answerId: "answer_002", score: 5, maxMarks: 5, correctness: "correct", feedback: "Excellent work. You correctly identified the chloroplast as the organelle responsible for photosynthesis and included the equation.", confidence: 0.93, status: "valid" },
  { questionId: "q_3", answerId: "answer_003", score: 3, maxMarks: 3, correctness: "correct", feedback: "Clear explanation of gas exchange and transpiration through stomata.", confidence: 0.9, status: "valid" },
  { questionId: "q_5", answerId: "answer_005", score: 4, maxMarks: 5, correctness: "partial", feedback: "The labelled process is correct. Marks were reduced slightly because the diagram description is incomplete compared with a full labelled drawing.", confidence: 0.84, status: "valid" },
  { questionId: "q_6", answerId: "answer_006", score: 3, maxMarks: 4, correctness: "partial", feedback: "Key difference is stated. Could be improved by mentioning examples and energy yield more precisely.", confidence: 0.86, status: "valid" },
  { questionId: "q_7_a", answerId: "answer_007a", score: 2, maxMarks: 2, correctness: "correct", feedback: "Accurate definition of transpiration.", confidence: 0.92, status: "valid" },
  { questionId: "q_7_b", answerId: "answer_007b", score: null, maxMarks: 3, correctness: "unavailable", feedback: "The handwriting is too unclear for a confident score. Teacher review is required.", confidence: 0.52, status: "review_required" },
  { questionId: "q_8", answerId: "answer_008", score: 3, maxMarks: 4, correctness: "partial", feedback: "Mentions enzymes, bile and villi. A fuller point on pancreatic enzymes would complete the answer.", confidence: 0.85, status: "valid" },
];

function pages(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    width: 595,
    height: 842,
    rotation: 0,
    blank: false,
  }));
}

export function getDemoAssessment(): AssessmentResult {
  const now = new Date().toISOString();
  return finalizeAssessment({
    questions,
    answers,
    mappings,
    grades,
    processingMetadata: {
      isDemo: true,
      model: "demo-dataset",
      startedAt: now,
      completedAt: now,
      durationMs: 2400,
      warnings: [
        "This is development demo data, not a live extraction.",
        "Question 4 is unanswered.",
        "One answer could not be mapped.",
        "Question 7(b) requires teacher review.",
      ],
      questionDocument: {
        kind: "question_paper",
        filename: "Class_10_science_unit_test.pdf",
        mime: "application/pdf",
        sizeBytes: 48000,
        pageCount: 2,
        pages: pages(2),
      },
      answerDocument: {
        kind: "answer_sheet",
        filename: "student_1_answer_sheet.pdf",
        mime: "application/pdf",
        sizeBytes: 92000,
        pageCount: 4,
        pages: pages(4),
      },
    },
  });
}

export const DEMO_FILES = {
  question: "/demo/question-paper.pdf",
  answer: "/demo/answer-sheet.pdf",
} as const;
