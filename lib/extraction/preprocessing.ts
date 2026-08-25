import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { assertPageCount } from "@/lib/files/validate";
import { log } from "@/lib/logging";
import type { DocumentKind, DocumentMeta, PageInfo, SupportedMime } from "@/types/assessment";

async function pdfMeta(bytes: Buffer, kind: DocumentKind, filename: string, mime: SupportedMime): Promise<DocumentMeta> {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = pdf.getPageCount();
    assertPageCount(pageCount, kind === "question_paper" ? "Question paper" : "Answer sheet");
    const pages: PageInfo[] = pdf.getPages().map((page, index) => {
      const { width, height } = page.getSize();
      const rotation = page.getRotation().angle;
      return {
        page: index + 1,
        width,
        height,
        rotation,
        blank: false,
      };
    });
    return {
      kind,
      filename,
      mime,
      sizeBytes: bytes.length,
      pageCount,
      pages,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("FILE_CORRUPTED", "The PDF could not be opened. It may be corrupted or encrypted.");
  }
}

async function imageMeta(bytes: Buffer, kind: DocumentKind, filename: string, mime: SupportedMime): Promise<{
  meta: DocumentMeta;
  processedBytes: Buffer;
}> {
  try {
    const image = sharp(bytes, { failOn: "none" }).rotate();
    const info = await image.metadata();
    const width = info.width ?? 0;
    const height = info.height ?? 0;
    if (width < 16 || height < 16) {
      throw new AppError("FILE_CORRUPTED", "The image is too small to process.");
    }

    const stats = await image.stats();
    const channels = stats.channels ?? [];
    const mean = channels.reduce((sum, channel) => sum + channel.mean, 0) / Math.max(channels.length, 1);
    const blank = mean > 245;

    let pipeline = image;
    const longEdge = Math.max(width, height);
    if (longEdge < 900) {
      pipeline = pipeline.resize({
        width: width >= height ? 1600 : undefined,
        height: height > width ? 1600 : undefined,
        fit: "inside",
        withoutEnlargement: false,
      });
    } else if (longEdge > 2400) {
      pipeline = pipeline.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
    }
    if (mean < 90) {
      pipeline = pipeline.normalize().sharpen();
    }

    const processedBytes = await pipeline.jpeg({ quality: 85 }).toBuffer();
    const processed = await sharp(processedBytes).metadata();

    return {
      processedBytes,
      meta: {
        kind,
        filename,
        mime,
        sizeBytes: bytes.length,
        pageCount: 1,
        pages: [
          {
            page: 1,
            width: processed.width ?? width,
            height: processed.height ?? height,
            rotation: info.orientation && info.orientation >= 5 ? 90 : 0,
            blank,
          },
        ],
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("FILE_CORRUPTED", "The image could not be processed.");
  }
}

export interface PreparedDocument {
  originalBytes: Buffer;
  aiBytes: Buffer;
  aiMime: SupportedMime;
  meta: DocumentMeta;
}

export async function preprocessDocument(input: {
  bytes: Buffer;
  mime: SupportedMime;
  filename: string;
  kind: DocumentKind;
}): Promise<PreparedDocument> {
  log.info("Document preprocessing started", {
    kind: input.kind,
    mime: input.mime,
    bytes: input.bytes.length,
  });

  if (input.mime === "application/pdf") {
    const meta = await pdfMeta(input.bytes, input.kind, input.filename, input.mime);
    return {
      originalBytes: input.bytes,
      aiBytes: input.bytes,
      aiMime: "application/pdf",
      meta,
    };
  }

  const { meta, processedBytes } = await imageMeta(input.bytes, input.kind, input.filename, input.mime);
  if (meta.pages[0]?.blank) {
    log.warn("Blank page detected", { kind: input.kind });
  }
  return {
    originalBytes: input.bytes,
    aiBytes: processedBytes,
    aiMime: "image/jpeg",
    meta,
  };
}
