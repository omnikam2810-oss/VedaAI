"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { overlayStyle } from "@/lib/coordinates";
// highlight helper lives in lib/coordinates to keep this module client-only for PDF.js
import { cn } from "@/lib/utils";
import type { AnswerRegion } from "@/types/assessment";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  url: string | null;
  mime?: string;
  filename?: string;
  pageCountHint?: number;
  highlights: Array<{ region: AnswerRegion; label: string }>;
  activePage?: number;
  activeRegionIndex?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
}

export function DocumentViewer({
  url,
  mime,
  highlights,
  activePage,
  activeRegionIndex = 0,
  onPageChange,
  emptyMessage,
}: DocumentViewerProps) {
  const isPdf = !mime || mime.includes("pdf") || url?.includes(".pdf");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(520);

  useEffect(() => {
    if (activePage && activePage !== page) setPage(activePage);
  }, [activePage, page]);

  useEffect(() => {
    const frame = document.getElementById("answer-frame");
    if (!frame) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setWidth(Math.max(280, next - 24));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const pageHighlights = useMemo(
    () => highlights.filter((item) => item.region.page === page && item.region.reliable),
    [highlights, page],
  );

  function changePage(next: number) {
    const clamped = Math.min(pageCount, Math.max(1, next));
    setPage(clamped);
    onPageChange?.(clamped);
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-[#888]">
        {emptyMessage || "Upload an answer sheet to inspect mapped regions."}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 rounded-full bg-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-white">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.1).toFixed(1))))}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2, Number((value + 0.1).toFixed(1))))}>
            +
          </button>
          <button type="button" className="ml-1 text-[11px] text-white/80" onClick={() => setZoom(1)}>
            Fit
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-white">
          <button type="button" aria-label="Previous page" onClick={() => changePage(page - 1)}>
            ‹
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button type="button" aria-label="Next page" onClick={() => changePage(page + 1)}>
            ›
          </button>
        </div>
      </div>
      {error ? (
        <p className="px-4 text-sm text-[#ef4444]">{error}</p>
      ) : null}
      <div id="answer-frame" className="min-h-0 flex-1 overflow-auto bg-[#f3f3f3] px-3 pb-6">
        <div className="mx-auto origin-top" style={{ width: width * zoom }}>
          <div className="relative overflow-hidden rounded-md bg-white shadow-sm" style={{ width: width * zoom }}>
            {isPdf ? (
              <Document
                file={url}
                onLoadSuccess={({ numPages }) => {
                  setPageCount(numPages);
                  setError(null);
                }}
                onLoadError={() => setError("The PDF could not be rendered.")}
                loading={<p className="p-8 text-sm text-[#888]">Rendering answer sheet…</p>}
              >
                <div className="relative">
                  <Page
                    pageNumber={page}
                    width={width * zoom}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                  {pageHighlights.map((item, index) => (
                    <AnswerHighlight
                      key={`${item.label}-${index}`}
                      region={item.region}
                      label={item.label}
                      active={index === activeRegionIndex || pageHighlights.length === 1}
                    />
                  ))}
                </div>
              </Document>
            ) : (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Answer sheet"
                  className="block w-full"
                  onLoad={() => setPageCount(1)}
                  onError={() => setError("The image could not be displayed.")}
                />
                {pageHighlights.map((item, index) => (
                  <AnswerHighlight
                    key={`${item.label}-${index}`}
                    region={item.region}
                    label={item.label}
                    active={index === activeRegionIndex || pageHighlights.length === 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnswerHighlight({
  region,
  label,
  active,
}: {
  region: AnswerRegion;
  label: string;
  active: boolean;
}) {
  if (!region.reliable) return null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-md border-2",
        active ? "border-[#22c55e] bg-[#22c55e]/10" : "border-[#86efac] bg-transparent",
      )}
      style={overlayStyle(region)}
    >
      <span className="absolute -top-5 left-0 rounded-t-md bg-[#22c55e] px-2 py-0.5 text-[11px] font-semibold text-white">
        {label}
      </span>
    </div>
  );
}

