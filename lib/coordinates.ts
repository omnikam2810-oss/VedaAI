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

const LABEL_PAD_X = 0.08;
const TRAIL_PAD_X = 0.03;
const PACKED_GAP = 0.008;
const MIN_HIGHLIGHT_HEIGHT = 0.03;
const LINE_HEIGHT = 0.034;

function pageSize(region: AnswerRegion): { pageWidth: number; pageHeight: number } {
  return {
    pageWidth: region.width > 0 ? region.width / Math.max(region.normalizedWidth, 0.0001) : 1,
    pageHeight: region.height > 0 ? region.height / Math.max(region.normalizedHeight, 0.0001) : 1,
  };
}

export function estimatedContentHeight(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return LINE_HEIGHT + 0.008;
  const explicitLines = trimmed.split(/\n/).filter((line) => line.trim()).length;
  const mathSteps = trimmed.split(/\s*(?:⇒|=>)\s*/).filter((part) => part.trim().length > 0).length;
  const wrapped = Math.ceil(trimmed.replace(/\s+/g, " ").length / 46);
  const lines = Math.max(explicitLines, mathSteps > 1 ? mathSteps : 1, wrapped, 1);
  return clamp(0.01 + lines * LINE_HEIGHT, 0.038, 0.62);
}

/** Grow left for the Ans. N label. Height is decided by page layout. */
export function expandHighlightRegion(region: AnswerRegion): AnswerRegion {
  const left = clamp(region.normalizedX - LABEL_PAD_X, 0, 1);
  const right = clamp(region.normalizedX + region.normalizedWidth + TRAIL_PAD_X, 0, 1);
  return fromNormalizedFractions({
    page: region.page,
    normalizedX: left,
    normalizedY: region.normalizedY,
    normalizedWidth: Math.max(0.04, right - left),
    normalizedHeight: Math.max(MIN_HIGHLIGHT_HEIGHT, region.normalizedHeight),
    ...pageSize(region),
  });
}

interface LayoutItem {
  key: string;
  text: string;
  region: AnswerRegion;
}

function layoutBandsOnPage(items: LayoutItem[]): Map<string, { top: number; bottom: number }> {
  const sorted = [...items].sort((left, right) => left.region.normalizedY - right.region.normalizedY);
  const bands = new Map<string, { top: number; bottom: number }>();
  let cursor = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index];
    const needed = Math.max(estimatedContentHeight(item.text), MIN_HIGHLIGHT_HEIGHT);
    const geminiTop = item.region.normalizedY;
    let top = geminiTop;
    if (geminiTop < cursor - 0.004 || geminiTop <= cursor + 0.02) {
      top = Math.max(geminiTop, cursor);
    }

    let bottom = top + needed;
    const nextTop = sorted[index + 1]?.region.normalizedY;
    if (nextTop !== undefined && nextTop > top + PACKED_GAP) {
      bottom = Math.min(bottom, nextTop - PACKED_GAP);
    }
    bottom = Math.max(bottom, top + MIN_HIGHLIGHT_HEIGHT);
    bands.set(item.key, { top, bottom });
    cursor = bottom + PACKED_GAP;
  }

  return bands;
}

export function clipHighlightToNeighbors(
  region: AnswerRegion,
  neighbors: AnswerRegion[],
  answerText = "",
): AnswerRegion {
  const items: LayoutItem[] = [
    { key: "self", text: answerText, region },
    ...neighbors.map((neighbor, index) => ({ key: `n${index}`, text: "", region: neighbor })),
  ];
  const band = layoutBandsOnPage(items).get("self");
  if (!band) return region;
  return fromNormalizedFractions({
    page: region.page,
    normalizedX: region.normalizedX,
    normalizedY: band.top,
    normalizedWidth: region.normalizedWidth,
    normalizedHeight: Math.max(MIN_HIGHLIGHT_HEIGHT, band.bottom - band.top),
    ...pageSize(region),
  });
}

export function highlightFromAnswer(
  answer: { regions: AnswerRegion[]; text?: string },
  label: string,
  neighbors: Array<{ regions: AnswerRegion[]; text?: string }> = [],
): Array<{ region: AnswerRegion; label: string }> {
  return answer.regions
    .map((region) => {
      const pageItems: LayoutItem[] = [
        { key: "self", text: answer.text ?? "", region },
        ...neighbors.flatMap((neighbor, index) =>
          neighbor.regions
            .filter((other) => other.page === region.page)
            .map((other) => ({ key: `n${index}-${other.page}`, text: neighbor.text ?? "", region: other })),
        ),
      ];
      const expanded = expandHighlightRegion(region);
      const band = layoutBandsOnPage(pageItems).get("self");
      if (!band) return expanded;
      return fromNormalizedFractions({
        page: expanded.page,
        normalizedX: expanded.normalizedX,
        normalizedY: band.top,
        normalizedWidth: expanded.normalizedWidth,
        normalizedHeight: Math.max(MIN_HIGHLIGHT_HEIGHT, band.bottom - band.top),
        ...pageSize(expanded),
      });
    })
    .filter((region) => region.reliable)
    .map((region) => ({ region, label }));
}
