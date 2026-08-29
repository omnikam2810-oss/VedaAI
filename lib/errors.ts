import { log } from "@/lib/logging";

export class AppError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    options?: { retryable?: boolean; status?: number },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.status = options?.status ?? 400;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  const status = googleStatus(error);
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    status === 429 ||
    message.includes("429") ||
    message.includes("resource exhausted") ||
    message.includes("quota")
  ) {
    return new AppError(
      "AI_RATE_LIMIT",
      "Gemini is rate-limited or out of free quota. Wait about a minute and retry, or use Demo Mode.",
      { retryable: true, status: 429 },
    );
  }
  if (status === 504 || message.includes("timeout") || message.includes("timed out") || message.includes("deadline")) {
    return new AppError("AI_TIMEOUT", "Gemini took too long to read the documents. Please retry.", {
      retryable: true,
      status: 504,
    });
  }
  if (
    message.includes("api key") ||
    message.includes("unauthenticated") ||
    status === 401 ||
    status === 403 ||
    message.includes("401")
  ) {
    return new AppError(
      "AI_UNAVAILABLE",
      "Gemini API key is missing or invalid. Add GEMINI_API_KEY in .env.local, or use Demo Mode.",
      { retryable: false, status: 503 },
    );
  }
  if (status === 404 || message.includes("not found") || message.includes("404")) {
    return new AppError(
      "AI_UNAVAILABLE",
      "The configured Gemini model is not available for this API key. Set GEMINI_MODEL=gemini-3.6-flash, or use Demo Mode.",
      { retryable: false, status: 503 },
    );
  }
  if (status === 503 || message.includes("overloaded") || message.includes("503")) {
    return new AppError("AI_UNAVAILABLE", "Gemini is temporarily overloaded. Please wait a moment and retry.", {
      retryable: true,
      status: 503,
    });
  }

  if (error instanceof Error) {
    log.error("Unhandled error", { reason: error.name, status: status ?? 0 });
    return new AppError("INTERNAL_ERROR", "Processing failed. Please retry, or use Demo Mode.", {
      retryable: true,
      status: 500,
    });
  }
  return new AppError("INTERNAL_ERROR", "An unexpected error occurred.", {
    retryable: true,
    status: 500,
  });
}

function googleStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = (error as { status: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export { googleStatus };
