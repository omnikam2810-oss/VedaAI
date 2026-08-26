"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { applyManualMapping, confirmMapping } from "@/lib/validation/business";
import type { AssessmentResult, ProcessingStep, StreamEvent } from "@/types/assessment";
import { INITIAL_STEPS } from "@/lib/constants";
import { parseStreamEvent } from "@/lib/utils";

interface SessionState {
  questionFile: File | null;
  answerFile: File | null;
  questionUrl: string | null;
  answerUrl: string | null;
  result: AssessmentResult | null;
  steps: ProcessingStep[];
  processing: boolean;
  error: { message: string; retryable: boolean; code?: string } | null;
  selectedQuestionId: string | null;
  selectedUnmappedId: string | null;
  regionIndex: number;
}

interface AssessmentContextValue extends SessionState {
  setQuestionFile: (file: File | null) => void;
  setAnswerFile: (file: File | null) => void;
  startProcessing: (demo?: boolean) => Promise<boolean>;
  selectQuestion: (id: string | null) => void;
  selectUnmapped: (id: string | null) => void;
  setRegionIndex: (index: number) => void;
  remap: (questionId: string, answerId: string | null) => void;
  confirmReview: (questionId: string) => void;
  reset: () => void;
  clearError: () => void;
}

const AssessmentContext = createContext<AssessmentContextValue | null>(null);

function revoke(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    questionFile: null,
    answerFile: null,
    questionUrl: null,
    answerUrl: null,
    result: null,
    steps: INITIAL_STEPS,
    processing: false,
    error: null,
    selectedQuestionId: null,
    selectedUnmappedId: null,
    regionIndex: 0,
  });

  const setQuestionFile = useCallback((file: File | null) => {
    setState((current) => {
      revoke(current.questionUrl);
      return {
        ...current,
        questionFile: file,
        questionUrl: file ? URL.createObjectURL(file) : null,
        error: null,
      };
    });
  }, []);

  const setAnswerFile = useCallback((file: File | null) => {
    setState((current) => {
      revoke(current.answerUrl);
      return {
        ...current,
        answerFile: file,
        answerUrl: file ? URL.createObjectURL(file) : null,
        error: null,
      };
    });
  }, []);

  const startProcessing = useCallback(async (demo = false) => {
    setState((current) => ({
      ...current,
      processing: true,
      error: null,
      result: null,
      steps: INITIAL_STEPS.map((step) => ({ ...step })),
    }));

    const form = new FormData();
    if (demo) {
      form.set("demo", "true");
      const [questionRes, answerRes] = await Promise.all([
        fetch("/demo/question-paper.pdf"),
        fetch("/demo/answer-sheet.pdf"),
      ]);
      if (!questionRes.ok || !answerRes.ok) {
        setState((current) => ({
          ...current,
          processing: false,
          error: { message: "Demo files could not be loaded.", retryable: true },
        }));
        return false;
      }
      const questionFile = new File([await questionRes.blob()], "Class_10_science_unit_test.pdf", {
        type: "application/pdf",
      });
      const answerFile = new File([await answerRes.blob()], "student_1_answer_sheet.pdf", {
        type: "application/pdf",
      });
      setState((current) => {
        revoke(current.questionUrl);
        revoke(current.answerUrl);
        return {
          ...current,
          questionFile,
          answerFile,
          questionUrl: URL.createObjectURL(questionFile),
          answerUrl: URL.createObjectURL(answerFile),
        };
      });
    } else {
      const snapshot = await new Promise<SessionState>((resolve) => {
        setState((current) => {
          resolve(current);
          return current;
        });
      });
      if (!snapshot.questionFile || !snapshot.answerFile) {
        setState((current) => ({
          ...current,
          processing: false,
          error: { message: "Upload both files to get started.", retryable: false },
        }));
        return false;
      }
      form.set("questionPaper", snapshot.questionFile);
      form.set("answerSheet", snapshot.answerFile);
    }

    try {
      const response = await fetch("/api/assessment/process", { method: "POST", body: form });
      if (!response.body) {
        throw new Error("No response stream from the server.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const parsed = parseStreamEvent(line);
          if (!parsed || typeof parsed !== "object") continue;
          const event = parsed as StreamEvent;
          if (event.type === "progress") {
            setState((current) => ({ ...current, steps: event.steps }));
          } else if (event.type === "complete") {
            completed = true;
            setState((current) => ({
              ...current,
              result: event.assessment,
              processing: false,
              selectedQuestionId: event.assessment.questions[0]?.id ?? null,
              selectedUnmappedId: null,
              regionIndex: 0,
            }));
          } else if (event.type === "error") {
            void reader.cancel();
            setState((current) => ({
              ...current,
              processing: false,
              error: { message: event.message, retryable: event.retryable, code: event.code },
            }));
            return false;
          }
        }
      }
      const trailing = parseStreamEvent(buffer);
      if (trailing && typeof trailing === "object") {
        const event = trailing as StreamEvent;
        if (event.type === "complete") {
          completed = true;
          setState((current) => ({
            ...current,
            result: event.assessment,
            processing: false,
            selectedQuestionId: event.assessment.questions[0]?.id ?? null,
            selectedUnmappedId: null,
            regionIndex: 0,
          }));
        } else if (event.type === "error") {
          setState((current) => ({
            ...current,
            processing: false,
            error: { message: event.message, retryable: event.retryable, code: event.code },
          }));
          return false;
        }
      }

      if (!completed) {
        setState((current) => ({
          ...current,
          processing: false,
          error: current.error ?? { message: "Processing ended without a result. Please retry.", retryable: true },
        }));
      }

      return completed;
    } catch (error) {
      setState((current) => ({
        ...current,
        processing: false,
        error: {
          message: error instanceof Error ? error.message : "Processing failed.",
          retryable: true,
        },
      }));
      return false;
    }
  }, []);

  const selectQuestion = useCallback((id: string | null) => {
    setState((current) => ({ ...current, selectedQuestionId: id, selectedUnmappedId: null, regionIndex: 0 }));
  }, []);

  const selectUnmapped = useCallback((id: string | null) => {
    setState((current) => ({ ...current, selectedUnmappedId: id, selectedQuestionId: null, regionIndex: 0 }));
  }, []);

  const setRegionIndex = useCallback((index: number) => {
    setState((current) => ({ ...current, regionIndex: index }));
  }, []);

  const remap = useCallback((questionId: string, answerId: string | null) => {
    setState((current) => {
      if (!current.result) return current;
      return { ...current, result: applyManualMapping(current.result, questionId, answerId), regionIndex: 0 };
    });
  }, []);

  const confirmReview = useCallback((questionId: string) => {
    setState((current) => {
      if (!current.result) return current;
      return { ...current, result: confirmMapping(current.result, questionId) };
    });
  }, []);

  const reset = useCallback(() => {
    setState((current) => {
      revoke(current.questionUrl);
      revoke(current.answerUrl);
      return {
        questionFile: null,
        answerFile: null,
        questionUrl: null,
        answerUrl: null,
        result: null,
        steps: INITIAL_STEPS,
        processing: false,
        error: null,
        selectedQuestionId: null,
        selectedUnmappedId: null,
        regionIndex: 0,
      };
    });
  }, []);

  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setQuestionFile,
      setAnswerFile,
      startProcessing,
      selectQuestion,
      selectUnmapped,
      setRegionIndex,
      remap,
      confirmReview,
      reset,
      clearError,
    }),
    [state, setQuestionFile, setAnswerFile, startProcessing, selectQuestion, selectUnmapped, setRegionIndex, remap, confirmReview, reset, clearError],
  );

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

export function useAssessment() {
  const value = useContext(AssessmentContext);
  if (!value) {
    throw new Error("useAssessment must be used within AssessmentProvider");
  }
  return value;
}
