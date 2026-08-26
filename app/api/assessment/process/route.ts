import { AppError, toAppError } from "@/lib/errors";
import { log } from "@/lib/logging";
import { encodeEvent, isGeminiConfigured, missingKeyError, runAssessmentPipeline, runDemoPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Parameters<typeof encodeEvent>[0]) => {
        controller.enqueue(encodeEvent(event));
      };

      try {
        const form = await request.formData();
        const demo = String(form.get("demo") ?? "") === "true";
        log.info("Assessment started", { demo });

        if (demo) {
          await runDemoPipeline(emit);
          return;
        }

        if (!isGeminiConfigured()) {
          throw missingKeyError();
        }

        const question = form.get("questionPaper");
        const answer = form.get("answerSheet");
        if (!(question instanceof File) || !(answer instanceof File)) {
          throw new AppError("FILE_MISSING", "Both a question paper and an answer sheet are required.");
        }

        await runAssessmentPipeline(question, answer, emit);
      } catch (error) {
        const appError = toAppError(error);
        log.error("Assessment failed", { code: appError.code, status: appError.status });
        emit({
          type: "error",
          code: appError.code,
          message: appError.message,
          retryable: appError.retryable,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
