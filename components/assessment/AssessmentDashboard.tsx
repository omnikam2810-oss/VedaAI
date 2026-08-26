"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { useAssessment } from "@/components/AssessmentProvider";
import {
  AssessmentSummary,
  ConfidenceBadge,
  QuestionItem,
  ReviewPanel,
} from "@/components/assessment/QuestionList";
import { highlightFromAnswer } from "@/lib/coordinates";
import { cn } from "@/lib/utils";

const DocumentViewer = dynamic(
  () => import("@/components/assessment/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false, loading: () => <p className="p-8 text-sm text-[#888]">Loading answer sheet…</p> },
);

export function AssessmentDashboard() {
  const router = useRouter();
  const {
    result,
    answerUrl,
    selectedQuestionId,
    selectedUnmappedId,
    regionIndex,
    selectQuestion,
    selectUnmapped,
    setRegionIndex,
    remap,
    confirmReview,
    processing,
    reset,
  } = useAssessment();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mobileTab, setMobileTab] = useState<"questions" | "sheet">("questions");

  const selectedQuestion = result?.questions.find((question) => question.id === selectedQuestionId);
  const selectedMapping = result?.mappings.find((mapping) => mapping.questionId === selectedQuestionId);
  const selectedAnswer = result?.answers.find((answer) => answer.id === selectedMapping?.answerId);
  const unmapped = result?.answers.find((answer) => answer.id === selectedUnmappedId);

  const highlights = useMemo(() => {
    if (unmapped) return highlightFromAnswer(unmapped, "Unmapped");
    if (selectedAnswer && selectedQuestion && selectedMapping?.status !== "unanswered") {
      return highlightFromAnswer(selectedAnswer, `Q${selectedQuestion.displayNumber.replace(" ", "")}`);
    }
    return [];
  }, [selectedAnswer, selectedMapping?.status, selectedQuestion, unmapped]);

  const regions = unmapped?.regions.filter((region) => region.reliable) ?? selectedAnswer?.regions.filter((region) => region.reliable) ?? [];
  const activeRegion = regions[Math.min(regionIndex, Math.max(regions.length - 1, 0))];

  if (!result && !processing) {
    return (
      <AppShell variant="upload">
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <h1 className="text-xl font-semibold">No assessment yet</h1>
          <p className="mt-2 max-w-md text-sm text-[#666]">Upload a question paper and answer sheet, or load the demo dataset, to see extracted questions and highlighted answers.</p>
          <button type="button" className="mt-5 rounded-full bg-[#1c1c1c] px-5 py-2.5 text-sm font-semibold text-white" onClick={() => router.push("/")}>
            Go to upload
          </button>
        </div>
      </AppShell>
    );
  }

  if (!result) {
    return (
      <AppShell variant="processing">
        <div className="flex h-full items-center justify-center text-sm text-[#888]">Preparing assessment…</div>
      </AppShell>
    );
  }

  const questions = result.questions;

  function toggleAll(open: boolean) {
    const next: Record<string, boolean> = {};
    questions.forEach((question) => {
      next[question.id] = open;
    });
    setExpanded(next);
  }

  const locationUnavailable =
    Boolean(selectedAnswer) &&
    selectedMapping?.status !== "unanswered" &&
    !selectedAnswer?.regions.some((region) => region.reliable);

  return (
    <AppShell variant="assessment">
      <div className="flex h-full min-h-0 flex-col">
        {result.processingMetadata.isDemo ? (
          <div className="bg-[#fff4e5] px-4 py-2 text-center text-xs text-[#9a3412]">
            Development demo data — not a live extraction. Real uploads still run through Gemini.
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-4 py-3 lg:hidden">
          <div className="flex rounded-full bg-[#efefef] p-1 text-sm font-medium">
            <button
              type="button"
              className={cn("rounded-full px-4 py-1.5", mobileTab === "questions" ? "bg-[#2f2f2f] text-white" : "text-[#222]")}
              onClick={() => setMobileTab("questions")}
            >
              Questions
            </button>
            <button
              type="button"
              className={cn("rounded-full px-4 py-1.5", mobileTab === "sheet" ? "bg-[#2f2f2f] text-white" : "text-[#222]")}
              onClick={() => setMobileTab("sheet")}
            >
              Answer Sheet
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <section className={cn("min-h-0 overflow-auto border-r border-[#f0f0f0] p-4", mobileTab === "sheet" && "hidden lg:block")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h1 className="text-[15px] font-semibold">Extracted Questions (from question paper)</h1>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs font-medium text-[#666]" onClick={() => toggleAll(!Object.values(expanded).some(Boolean))}>
                  Expand All
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-[#ff6b4a]"
                  onClick={() => {
                    reset();
                    router.push("/");
                  }}
                >
                  New assessment
                </button>
              </div>
            </div>
            <AssessmentSummary result={result} />
            <div className="mt-4 space-y-3">
              {result.questions.map((question) => {
                const mapping = result.mappings.find((item) => item.questionId === question.id);
                const answer = result.answers.find((item) => item.id === mapping?.answerId);
                const grade = result.grades.find((item) => item.questionId === question.id);
                return (
                  <div key={question.id} className="space-y-2">
                    <QuestionItem
                      question={question}
                      mapping={mapping}
                      grade={grade}
                      answer={answer}
                      selected={selectedQuestionId === question.id}
                      expanded={Boolean(expanded[question.id]) || selectedQuestionId === question.id}
                      onSelect={() => {
                        selectQuestion(question.id);
                        setExpanded((current) => ({ ...current, [question.id]: true }));
                        setMobileTab("sheet");
                      }}
                      onToggle={() => setExpanded((current) => ({ ...current, [question.id]: !current[question.id] }))}
                    />
                    {(Boolean(expanded[question.id]) || selectedQuestionId === question.id) && mapping && (mapping.status === "review_required" || mapping.status === "conflict" || mapping.status === "unanswered") ? (
                      <ReviewPanel
                        result={result}
                        question={question}
                        mapping={mapping}
                        onChange={(answerId) => remap(question.id, answerId || null)}
                        onConfirm={() => confirmReview(question.id)}
                        onUnanswered={() => remap(question.id, null)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {result.unmatchedAnswers.length ? (
              <div className="mt-6">
                <h2 className="text-sm font-semibold">Unmapped answers</h2>
                <div className="mt-2 space-y-2">
                  {result.unmatchedAnswers.map((answer) => (
                    <button
                      key={answer.id}
                      type="button"
                      onClick={() => {
                        selectUnmapped(answer.id);
                        setMobileTab("sheet");
                      }}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left text-sm",
                        selectedUnmappedId === answer.id ? "border-[#ff6b4a]" : "border-[#eee] bg-white",
                      )}
                    >
                      <p className="font-medium">Unmapped answer</p>
                      <p className="mt-1 text-xs text-[#777]">Page {answer.regions[0]?.page ?? "unknown"}</p>
                      <p className="mt-1 text-[#444]">{answer.text.slice(0, 140) || "Unable to confidently associate this answer with a question."}</p>
                      <div className="mt-2">
                        <ConfidenceBadge confidence={answer.confidence} status="unmatched" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className={cn("flex min-h-0 flex-col bg-[#f6f6f6]", mobileTab === "questions" && "hidden lg:flex")}>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">Answer Sheet</h2>
              {regions.length > 1 ? (
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" className="rounded-full bg-[#2a2a2a] px-2 py-1 text-white" onClick={() => setRegionIndex(Math.max(0, regionIndex - 1))}>
                    Previous region
                  </button>
                  <span>
                    {Math.min(regionIndex + 1, regions.length)} of {regions.length}
                  </span>
                  <button type="button" className="rounded-full bg-[#2a2a2a] px-2 py-1 text-white" onClick={() => setRegionIndex(Math.min(regions.length - 1, regionIndex + 1))}>
                    Next region
                  </button>
                </div>
              ) : null}
            </div>
            {selectedMapping?.status === "unanswered" ? (
              <div className="mx-4 mb-3 rounded-xl bg-[#fff4e5] px-3 py-2 text-sm text-[#9a3412]">
                No answer detected for {selectedQuestion?.displayNumber}. Highlighting is disabled.
              </div>
            ) : null}
            {locationUnavailable ? (
              <div className="mx-4 mb-3 rounded-xl bg-[#fff4e5] px-3 py-2 text-sm text-[#9a3412]">
                Location unavailable. Unable to reliably determine the answer region.
              </div>
            ) : null}
            <DocumentViewer
              url={answerUrl}
              mime={result.processingMetadata.answerDocument.mime}
              highlights={selectedMapping?.status === "unanswered" ? [] : highlights}
              activePage={activeRegion?.page}
              activeRegion={activeRegion}
              emptyMessage="The answer sheet could not be loaded."
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
