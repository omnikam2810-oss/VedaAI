import { GoogleGenAI } from "@google/genai";
import { DEFAULT_MODEL, FALLBACK_MODEL } from "@/lib/constants";
import { AppError, toAppError } from "@/lib/errors";
import { log } from "@/lib/logging";
import { sleep, safeJsonParse } from "@/lib/utils";
import type { SupportedMime } from "@/types/assessment";
import type { z } from "zod";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "AI_UNAVAILABLE",
      "Gemini API key is not configured. Add GEMINI_API_KEY to .env.local or use Demo Mode.",
      { status: 503, retryable: false },
    );
  }
  return new GoogleGenAI({ apiKey });
}

export function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

interface GenerateJsonArgs<T> {
  prompt: string;
  documents: Array<{ mime: SupportedMime; bytes: Buffer; filename: string }>;
  extraText?: string;
  schema: z.ZodType<T>;
  label: string;
}

async function generateOnce(model: string, parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>): Promise<string> {
  const client = getClient();
  const parsedTimeout = Number(process.env.GEMINI_TIMEOUT_MS ?? 45000);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout >= 5000 ? parsedTimeout : 45000;
  const timeout = new AppError("AI_TIMEOUT", "The AI service timed out. Please retry.", {
    retryable: true,
    status: 504,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      client.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeout), timeoutMs);
      }),
    ]);
    const text = response.text;
    if (!text) {
      throw new AppError("AI_EMPTY", "The AI returned an empty response.", { retryable: true, status: 502 });
    }
    return text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateValidatedJson<T>(args: GenerateJsonArgs<T>): Promise<T> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: args.prompt },
  ];
  if (args.extraText) {
    parts.push({ text: args.extraText });
  }
  for (const document of args.documents) {
    parts.push({
      inlineData: {
        mimeType: document.mime,
        data: document.bytes.toString("base64"),
      },
    });
  }

  const models = [getModelName(), FALLBACK_MODEL].filter((model, index, list) => list.indexOf(model) === index);
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        log.info("AI request started", { label: args.label, model, attempt: attempt + 1 });
        const text = await generateOnce(model, parts);
        const parsed = safeJsonParse(text);
        const validated = args.schema.safeParse(parsed);
        if (!validated.success) {
          throw new AppError(
            "AI_MALFORMED",
            `The AI response for ${args.label} failed validation and was rejected.`,
            { retryable: attempt < 1, status: 502 },
          );
        }
        log.info("AI request completed", { label: args.label, model });
        return validated.data;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const rateLimited = message.includes("429") || message.includes("resource exhausted");
        const unavailable = message.includes("not found") || message.includes("404");
        const timedOut = error instanceof AppError && error.code === "AI_TIMEOUT";
        if (unavailable) break;
        if ((rateLimited || timedOut) && attempt < 1) {
          log.warn("AI retrying", { label: args.label, attempt: attempt + 1 });
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        if (error instanceof AppError && error.code === "AI_MALFORMED" && attempt < 1) {
          await sleep(400);
          continue;
        }
        break;
      }
    }
  }

  if (lastError instanceof AppError) throw lastError;
  throw toAppError(lastError);
}
