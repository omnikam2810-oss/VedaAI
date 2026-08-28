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
  const x = input.x;
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

const LABEL_PAD_X = 0.03;
const EDGE_INSET_Y = 0.012;
const NEIGHBOR_GAP = 0.01;
const MIN_HIGHLIGHT_HEIGHT = 0.035;

function overlapsHorizontally(
  left: number,
  right: number,
  other: { normalizedX: number; normalizedWidth: number },
): boolean {
  const otherRight = other.normalizedX + other.normalizedWidth;
  return left < otherRight - 0.01 && right > other.normalizedX + 0.01;
}

/**
 * Tighten a Gemini box so it covers this answer (including "Ans. N") without
 * sitting on the previous or next answer on the same page.
 */
export function fitHighlightRegion(region: AnswerRegion, neighbors: AnswerRegion[]): AnswerRegion {
  let left = clamp(region.normalizedX - LABEL_PAD_X, 0, 1);
  let right = clamp(region.normalizedX + region.normalizedWidth + 0.01, 0, 1);
  let top = clamp(region.normalizedY + EDGE_INSET_Y, 0, 1);
  let bottom = clamp(region.normalizedY + region.normalizedHeight - EDGE_INSET_Y, 0, 1);

  if (bottom - top < MIN_HIGHLIGHT_HEIGHT) {
    top = region.normalizedY;
    bottom = region.normalizedY + region.normalizedHeight;
  }

  const others = neighbors.filter(
    (other) =>
      other.reliable &&
      other.page === region.page &&
      (Math.abs(other.normalizedY - region.normalizedY) > 0.002 ||
        Math.abs(other.normalizedHeight - region.normalizedHeight) > 0.002 ||
        Math.abs(other.normalizedX - region.normalizedX) > 0.002),
  );

  for (const other of others) {
    if (!overlapsHorizontally(left, right, other)) continue;
    const otherTop = other.normalizedY;
    const otherBottom = other.normalizedY + other.normalizedHeight;
    const mid = (top + bottom) / 2;
    const otherMid = (otherTop + otherBottom) / 2;

    if (otherMid <= mid) {
      const limit = otherBottom + NEIGHBOR_GAP;
      if (limit < bottom - MIN_HIGHLIGHT_HEIGHT) {
        top = Math.max(top, limit);
      }
    } else {
      const limit = otherTop - NEIGHBOR_GAP;
      if (limit > top + MIN_HIGHLIGHT_HEIGHT) {
        bottom = Math.min(bottom, limit);
      }
    }
  }

  return fromNormalizedFractions({
    page: region.page,
    normalizedX: left,
    normalizedY: top,
    normalizedWidth: Math.max(0.04, right - left),
    normalizedHeight: Math.max(MIN_HIGHLIGHT_HEIGHT, bottom - top),
    pageWidth: region.width > 0 ? region.width / Math.max(region.normalizedWidth, 0.0001) : 1,
    pageHeight: region.height > 0 ? region.height / Math.max(region.normalizedHeight, 0.0001) : 1,
  });
}

export function highlightFromAnswer(
  answer: { regions: AnswerRegion[] },
  label: string,
  neighbors: Array<{ regions: AnswerRegion[] }> = [],
): Array<{ region: AnswerRegion; label: string }> {
  const otherRegions = neighbors.flatMap((item) => item.regions.filter((region) => region.reliable));
  return answer.regions
    .filter((region) => region.reliable)
    .map((region) => ({ region: fitHighlightRegion(region, otherRegions), label }));
}
