import { clamp } from "@/lib/utils";
import type { AnswerRegion, PageInfo } from "@/types/assessment";

export function toNormalizedRegion(input: {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  coordinateSystem: AnswerRegion["coordinateSystem"];
  origin?: "top-left" | "bottom-left";
}): AnswerRegion {
  const pageWidth = Math.max(input.pageWidth, 1);
  const pageHeight = Math.max(input.pageHeight, 1);
  let x = input.x;
  let y = input.y;
  const width = input.width;
  const height = input.height;

  if (input.origin === "bottom-left") {
    y = pageHeight - y - height;
  }

  const normalizedX = clamp(x / pageWidth, 0, 1);
  const normalizedY = clamp(y / pageHeight, 0, 1);
  const normalizedWidth = clamp(width / pageWidth, 0, 1);
  const normalizedHeight = clamp(height / pageHeight, 0, 1);

  return {
    page: input.page,
    x,
    y,
    width,
    height,
    normalizedX,
    normalizedY,
    normalizedWidth,
    normalizedHeight,
    coordinateSystem: input.coordinateSystem,
    reliable: isReliableRegion({
      normalizedX,
      normalizedY,
      normalizedWidth,
      normalizedHeight,
    }),
  };
}

export function fromNormalizedFractions(input: {
  page: number;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  pageWidth?: number;
  pageHeight?: number;
}): AnswerRegion {
  const pageWidth = input.pageWidth ?? 1;
  const pageHeight = input.pageHeight ?? 1;
  const normalizedX = clamp(input.normalizedX, 0, 1);
  const normalizedY = clamp(input.normalizedY, 0, 1);
  const normalizedWidth = clamp(input.normalizedWidth, 0, 1);
  const normalizedHeight = clamp(input.normalizedHeight, 0, 1);

  return {
    page: input.page,
    x: normalizedX * pageWidth,
    y: normalizedY * pageHeight,
    width: normalizedWidth * pageWidth,
    height: normalizedHeight * pageHeight,
    normalizedX,
    normalizedY,
    normalizedWidth,
    normalizedHeight,
    coordinateSystem: "normalized",
    reliable: isReliableRegion({
      normalizedX,
      normalizedY,
      normalizedWidth,
      normalizedHeight,
    }),
  };
}

export function isReliableRegion(region: {
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
}): boolean {
  if (![region.normalizedX, region.normalizedY, region.normalizedWidth, region.normalizedHeight].every(Number.isFinite)) {
    return false;
  }
  if (region.normalizedWidth < 0.04 || region.normalizedHeight < 0.03) {
    return false;
  }
  if (region.normalizedWidth > 0.98 && region.normalizedHeight > 0.98) {
    return false;
  }
  if (region.normalizedX + region.normalizedWidth > 1.02) return false;
  if (region.normalizedY + region.normalizedHeight > 1.02) return false;
  return true;
}

export function regionWithinPage(region: AnswerRegion, pages: PageInfo[]): boolean {
  const page = pages.find((item) => item.page === region.page);
  if (!page) return false;
  return region.page >= 1 && region.normalizedX >= 0 && region.normalizedY >= 0;
}

export function overlayStyle(region: AnswerRegion): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${region.normalizedX * 100}%`,
    top: `${region.normalizedY * 100}%`,
    width: `${region.normalizedWidth * 100}%`,
    height: `${region.normalizedHeight * 100}%`,
  };
}

export function highlightFromAnswer(
  answer: { regions: AnswerRegion[] },
  label: string,
): Array<{ region: AnswerRegion; label: string }> {
  return answer.regions.filter((region) => region.reliable).map((region) => ({ region, label }));
}
