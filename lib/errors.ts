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
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("429") || message.includes("resource exhausted") || message.includes("rate")) {
      return new AppError("AI_RATE_LIMIT", "The AI service is rate limited. Please wait a moment and retry.", {
        retryable: true,
        status: 429,
      });
    }
    if (message.includes("timeout") || message.includes("timed out")) {
      return new AppError("AI_TIMEOUT", "The AI service timed out. Please retry.", {
        retryable: true,
        status: 504,
      });
    }
    if (message.includes("api key") || message.includes("unauthenticated") || message.includes("401")) {
      return new AppError(
        "AI_UNAVAILABLE",
        "Gemini API key is missing or invalid. Add GEMINI_API_KEY in .env.local, or use Demo Mode.",
        { retryable: false, status: 503 },
      );
    }
    return new AppError("INTERNAL_ERROR", error.message, { retryable: true, status: 500 });
  }
  return new AppError("INTERNAL_ERROR", "An unexpected error occurred.", {
    retryable: true,
    status: 500,
  });
}
