"use client";

import { Check, Circle, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcessingStep as Step } from "@/types/assessment";

export function ProcessingProgress({ steps }: { steps: Step[] }) {
  return (
    <ol className="mx-auto mt-8 w-full max-w-md space-y-2 text-left">
      {steps.map((step) => (
        <ProcessingStepItem key={step.id} step={step} />
      ))}
    </ol>
  );
}

export function ProcessingStepItem({ step }: { step: Step }) {
  return (
    <li className="flex items-start gap-3 rounded-xl px-3 py-2">
      <StatusIcon status={step.status} />
      <div>
        <p className="text-sm font-medium text-[#1a1a1a]">{step.label}</p>
        <p className="text-xs text-[#8b8b8b]">
          {step.status === "completed" && (step.detail || "Completed")}
          {step.status === "processing" && (step.detail || "Processing")}
          {step.status === "pending" && "Pending"}
          {step.status === "failed" && (step.detail || "Failed")}
        </p>
      </div>
    </li>
  );
}

function StatusIcon({ status }: { status: Step["status"] }) {
  if (status === "completed") {
    return (
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#22c55e] text-white" aria-label="Completed">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center text-[#ff6b4a]" aria-label="Processing">
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ef4444] text-[10px] font-bold text-white" aria-label="Failed">
        !
      </span>
    );
  }
  return <Circle className="mt-0.5 h-5 w-5 text-[#d0d0d0]" aria-label="Pending" />;
}

export function SparkleLoader() {
  return (
    <div className="flex items-end justify-center gap-2" aria-hidden>
      <Sparkle className="sparkle-1 mb-2 h-6 w-6 text-[#ff6b4a]" />
      <Sparkle className="sparkle-2 h-10 w-10 text-[#ff5c33]" />
      <Sparkle className="sparkle-3 mb-1 h-5 w-5 text-[#ff8a65]" />
    </div>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(className)}>
      <path
        d="M12 0.8L14.4 8.8 22.5 11.2 14.4 13.6 12 21.6 9.6 13.6 1.5 11.2 9.6 8.8 12 0.8Z"
        fill="currentColor"
      />
    </svg>
  );
}
