import { AppError } from "@/lib/errors";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "@/lib/constants";
import { sniffMime } from "@/lib/files/sniff";
import type { SupportedMime } from "@/types/assessment";

export { sniffMime };

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function declaredMime(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  const ext = extensionOf(file.name);
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "";
}

export async function validateUpload(
  file: File | null,
  label: string,
): Promise<{ bytes: Buffer; mime: SupportedMime; filename: string }> {
  if (!file) {
    throw new AppError("FILE_MISSING", `${label} is required.`);
  }

  if (file.size <= 0) {
    throw new AppError("FILE_EMPTY", `${label} is empty.`);
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new AppError("FILE_TOO_LARGE", `${label} exceeds the 10MB limit.`);
  }

  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new AppError(
      "FILE_TYPE_UNSUPPORTED",
      `${label} must be a PDF, PNG, JPG, or JPEG file.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(bytes);
  if (!sniffed) {
    throw new AppError(
      "FILE_CORRUPTED",
      `${label} could not be read. The file may be corrupted or is not a supported document.`,
    );
  }

  const declared = declaredMime(file);
  if (declared && !ALLOWED_MIME_TYPES.includes(declared as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new AppError("FILE_TYPE_UNSUPPORTED", `${label} must be a PDF, PNG, JPG, or JPEG file.`);
  }

  if (declared && declared !== sniffed && !(declared === "image/jpg" && sniffed === "image/jpeg")) {
    if (declared.startsWith("image/") && sniffed.startsWith("image/")) {
      return { bytes, mime: sniffed, filename: file.name };
    }
    throw new AppError(
      "FILE_TYPE_MISMATCH",
      `${label} file contents do not match its declared type.`,
    );
  }

  return { bytes, mime: sniffed, filename: file.name };
}

export function assertPageCount(count: number, label: string): void {
  if (count < 1) {
    throw new AppError("FILE_EMPTY", `${label} does not contain any readable pages.`);
  }
  if (count > 30) {
    throw new AppError("FILE_TOO_MANY_PAGES", `${label} has more than 30 pages. Please upload a shorter document.`);
  }
}
