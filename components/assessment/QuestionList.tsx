"use client";

import { AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn, percent } from "@/lib/utils";
import { HIGH_CONFIDENCE } from "@/lib/constants";
import type { Answer, AssessmentResult, Grade, Mapping, Question } from "@/types/assessment";

export function ConfidenceBadge({
  confidence,
  status,
}: {
  confidence: number;
  status?: string;
}) {
  const review = status === "review_required" || status === "conflict" || confidence < HIGH_CONFIDENCE;
  const failed = status === "failed" || status === "unanswered" || status === "unmatched";
  const label = failed ? (status === "unanswered" ? "Unanswered" : status === "unmatched" ? "Unmapped" : "Failed") : review ? "Review Required" : "High Confidence";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        failed ? "bg-[#fee2e2] text-[#b91c1c]" : review ? "bg-[#fff4e5] text-[#b45309]" : "bg-[#dcfce7] text-[#15803d]",
      )}
    >
      {label}
      {!failed ? ` · ${percent(confidence)}` : ""}
    </span>
  );
}

export function ScorePill({ grade, unanswered }: { grade?: Grade; unanswered?: boolean }) {
  if (unanswered) {
    return <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[12px] font-semibold text-[#dc2626]">Unanswered</span>;
  }
  if (!grade || grade.score === null || grade.maxMarks === null) {
    return <span className="rounded-full bg-[#f3f3f3] px-2 py-0.5 text-[12px] font-medium text-[#666]">Score unavailable</span>;
  }
  const zero = grade.score === 0;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", zero ? "bg-[#fee2e2] text-[#dc2626]" : "bg-[#dcfce7] text-[#16a34a]")}>
      {grade.score}/{grade.maxMarks}
    </span>
  );
}

export function QuestionStatus({ mapping }: { mapping?: Mapping }) {
  if (!mapping || mapping.status === "unanswered") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b45309]">
        <AlertTriangle className="h-3.5 w-3.5" /> Unanswered
      </span>
    );
  }
  if (mapping.status === "review_required" || mapping.status === "conflict") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b45309]">
        <AlertTriangle className="h-3.5 w-3.5" /> Review required
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803d]">
      <Check className="h-3.5 w-3.5" /> Answered
    </span>
  );
}

export function QuestionItem({
  question,
  mapping,
  grade,
  answer,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  question: Question;
  mapping?: Mapping;
  grade?: Grade;
  answer?: Answer;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition",
        selected ? "border-[#ff6b4a]" : "border-transparent",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white",
              selected ? "bg-[#ff6b4a]" : "bg-[#2f2f2f]",
            )}
          >
            {question.displayNumber.replace(" ", "")}
          </span>
          <span className="min-w-0 flex-1 text-[14px] leading-5 text-[#222]">{question.text}</span>
        </button>
        <div className="flex items-center gap-2">
          <ScorePill grade={grade} unanswered={mapping?.status === "unanswered"} />
          <button type="button" aria-expanded={expanded} aria-label={expanded ? "Collapse question" : "Expand question"} onClick={onToggle} className="rounded-full p-1 hover:bg-[#f4f4f4]">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-[#f1f1f1] pt-3">
          <QuestionStatus mapping={mapping} />
          <ConfidenceBadge confidence={mapping?.confidence ?? question.confidence} status={mapping?.status ?? question.status} />
          {answer?.text ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">Extracted answer</p>
              <p className="mt-1 text-sm leading-5 text-[#333]">{answer.text}</p>
            </div>
          ) : (
            <p className="text-sm text-[#888]">No answer detected.</p>
          )}
          {grade?.feedback ? (
            <FeedbackPanel feedback={grade.feedback} />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function FeedbackPanel({ feedback }: { feedback: string }) {
  return (
    <div className="rounded-xl bg-[#f5f5f5] p-3">
      <p className="text-sm font-semibold">AI Feedback</p>
      <p className="mt-1 text-sm leading-5 text-[#444]">{feedback}</p>
      <p className="mt-2 text-[11px] text-[#888]">AI-generated assessment · Teacher review recommended</p>
    </div>
  );
}

export function ReviewPanel({
  result,
  question,
  mapping,
  onChange,
  onConfirm,
  onUnanswered,
}: {
  result: AssessmentResult;
  question: Question;
  mapping?: Mapping;
  onChange: (answerId: string) => void;
  onConfirm: () => void;
  onUnanswered: () => void;
}) {
  if (!mapping || (mapping.status !== "review_required" && mapping.status !== "conflict" && mapping.status !== "unanswered")) return null;
  const current = result.answers.find((answer) => answer.id === mapping.answerId);
  const title = mapping.status === "unanswered" ? "No answer mapped" : "Review required";

  return (
    <div className="rounded-xl border border-[#f5d0a6] bg-[#fff8ef] p-3">
      <p className="text-sm font-semibold text-[#9a3412]">{title}</p>
      <p className="mt-1 text-sm text-[#7c2d12]">
        {mapping.reviewReason || "This mapping needs a teacher decision."}
      </p>
      <p className="mt-2 text-xs text-[#7c2d12]">
        Current mapping: {current ? current.id.replace("answer_", "Answer ") : "None"} · {percent(mapping.confidence)}
      </p>
      <label className="mt-3 block text-xs font-medium text-[#7c2d12]" htmlFor={`remap-${question.id}`}>
        Change answer
      </label>
      <select
        id={`remap-${question.id}`}
        className="mt-1 w-full rounded-lg border border-[#f0d2b0] bg-white px-2 py-1.5 text-sm"
        value={mapping.answerId ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select an answer</option>
        {result.answers.map((answer) => (
          <option key={answer.id} value={answer.id}>
            {(answer.questionReference ? `Q${answer.questionReference} · ` : "") + answer.text.slice(0, 48)}
          </option>
        ))}
      </select>
      <div className="mt-3 flex flex-wrap gap-2">
        {mapping.answerId ? (
          <button type="button" className="rounded-full bg-[#1c1c1c] px-3 py-1.5 text-xs font-semibold text-white" onClick={onConfirm}>
            Confirm mapping
          </button>
        ) : null}
        <button type="button" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#7c2d12]" onClick={onUnanswered}>
          Mark unanswered
        </button>
      </div>
    </div>
  );
}

export function AssessmentSummary({ result }: { result: AssessmentResult }) {
  const { summary } = result;
  const items = [
    ["Total questions", summary.totalQuestions],
    ["Answered", summary.answered],
    ["Unanswered", summary.unanswered],
    ["Review required", summary.reviewRequired],
    ["Unmapped answers", summary.unmappedAnswers],
  ] as const;

  return (
    <section className="rounded-2xl bg-[#f7f7f7] p-4">
      <h2 className="text-sm font-semibold">Assessment summary</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white px-3 py-2">
            <dt className="text-[11px] text-[#888]">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.score !== null && summary.maxScore !== null ? (
        <>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-white px-3 py-2">
              <dt className="text-[11px] text-[#888]">Marks obtained</dt>
              <dd className="font-semibold">{summary.score}</dd>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <dt className="text-[11px] text-[#888]">Total marks</dt>
              <dd className="font-semibold">{summary.maxScore}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-semibold">
            Overall marks {summary.score} / {summary.maxScore}
            {summary.percentage !== null ? ` · ${summary.percentage}%` : ""}
          </p>
          {result.paperScheme?.paperMaxMarks || result.paperScheme?.sections.length ? (
            <p className="mt-1 text-xs text-[#666]">
              Total marks are the printed paper maximum (internal choice). Unused optional questions are not added to that total.
            </p>
          ) : summary.unanswered > 0 ? (
            <p className="mt-1 text-xs text-[#666]">Unanswered questions are scored 0 and included in the total.</p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-[#888]">Overall marks unavailable until printed marks can be determined reliably.</p>
      )}
      {summary.aiSummary ? <p className="mt-2 text-sm text-[#444]">{summary.aiSummary}</p> : null}
      <p className="mt-2 text-[11px] text-[#888]">AI-generated assessment · Teacher review recommended</p>
    </section>
  );
}
