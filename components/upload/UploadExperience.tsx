"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAssessment } from "@/components/AssessmentProvider";
import { FileUploader } from "@/components/upload/FileUploader";
import { ProcessingProgress, SparkleLoader } from "@/components/processing/ProcessingProgress";
import { cn } from "@/lib/utils";

export function UploadExperience() {
  const router = useRouter();
  const startedDemo = useRef(false);
  const {
    questionFile,
    answerFile,
    setQuestionFile,
    setAnswerFile,
    startProcessing,
    processing,
    steps,
    error,
    clearError,
    result,
  } = useAssessment();

  const ready = Boolean(questionFile && answerFile) && !processing;

  const analyze = useCallback(
    async (demo = false) => {
      const ok = await startProcessing(demo);
      if (ok) router.push("/assessment");
    },
    [startProcessing, router],
  );

  useEffect(() => {
    if (typeof window === "undefined" || startedDemo.current || processing || result) return;
    const demo = new URLSearchParams(window.location.search).get("demo") === "1";
    if (!demo) return;
    startedDemo.current = true;
    void analyze(true);
  }, [analyze, processing, result]);

  return (
    <AppShell variant={processing ? "processing" : "upload"}>
      {processing ? (
        <section className="flex h-full min-h-[70vh] flex-col items-center justify-center px-6 py-10 text-center">
          <SparkleLoader />
          <h1 className="mt-6 text-[28px] font-semibold tracking-tight">Extracting...</h1>
          <p className="mt-1 text-sm text-[#8b8b8b]">This may take a while</p>
          <ProcessingProgress steps={steps} />
        </section>
      ) : (
        <section className="flex h-full flex-col items-center overflow-auto px-4 py-8 md:px-10">
          <div className="relative mb-2">
            <span className="absolute -left-8 top-6 h-4 w-4 rounded-full bg-[#ffb199]" />
            <span className="absolute -right-6 top-2 h-6 w-6 rounded-full bg-[#ff8a65]/70" />
            <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-[#ffd0c4]" />
            <div className="relative h-[120px] w-[120px] overflow-hidden rounded-full bg-[#f6e7c8] shadow-[0_0_0_10px_rgba(255,107,74,0.12)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/teacher-illustration.svg"
                alt="Teacher ready to upload exam papers"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <h1 className="mt-6 max-w-2xl text-center text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">
            Upload{" "}
            <span className="rounded-md bg-[#ffd8ce] px-2 py-0.5 text-[#ff6b4a]">
              Question Paper & Answer Sheets
            </span>
          </h1>
          <p className="mt-2 text-sm text-[#8b8b8b]">Upload both files to get started</p>

          <div className="mt-8 grid w-full max-w-3xl gap-4 md:grid-cols-2">
            <FileUploader
              label="question paper"
              accent="Question Paper"
              file={questionFile}
              onFile={setQuestionFile}
            />
            <FileUploader
              label="answer sheet"
              accent="Answer Sheet"
              file={answerFile}
              onFile={setAnswerFile}
            />
          </div>

          {error ? (
            <div className="mt-5 w-full max-w-xl rounded-2xl bg-[#fff1f0] px-4 py-3 text-sm text-[#b42318]" role="alert">
              <p>{error.message}</p>
              <div className="mt-2 flex gap-3">
                {error.retryable ? (
                  <button type="button" className="font-medium underline" onClick={() => void analyze()}>
                    Retry
                  </button>
                ) : null}
                <button type="button" className="font-medium underline" onClick={() => void analyze(true)}>
                  Use demo dataset
                </button>
                <button type="button" className="text-[#666] underline" onClick={clearError}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!ready}
            onClick={() => void analyze()}
            className={cn(
              "mt-8 rounded-full px-8 py-3 text-sm font-semibold transition",
              ready ? "bg-[#1c1c1c] text-white hover:bg-black" : "cursor-not-allowed bg-[#ececec] text-[#b0b0b0]",
            )}
          >
            Start Mapping →
          </button>
          <p className="mt-3 max-w-md text-center text-xs text-[#9a9a9a]">
            Once both files are uploaded, you&apos;ll be able to map answers with questions
          </p>
          <button
            type="button"
            className="mt-5 text-xs font-medium text-[#ff6b4a] underline-offset-2 hover:underline"
            onClick={() => void analyze(true)}
          >
            Preview with development demo data
          </button>
        </section>
      )}
    </AppShell>
  );
}
