import { cn } from "@/lib/utils";

export function VedaLogo({ compact = false, inverted = false, className }: { compact?: boolean; inverted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-[8px] text-[18px] font-semibold leading-none",
          inverted ? "bg-white text-black" : "bg-[#1c1c1c] text-white",
        )}
        aria-hidden
      >
        V
      </span>
      {!compact ? <span className="text-[18px] font-semibold tracking-tight">VedaAI</span> : null}
    </div>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 1.5L13.9 9.1 21.5 11 13.9 12.9 12 20.5 10.1 12.9 2.5 11 10.1 9.1 12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PdfGlyph() {
  return (
    <span className="relative flex h-10 w-8 shrink-0 items-center justify-center rounded-[3px] bg-[#e53935] text-[9px] font-bold text-white shadow-sm">
      PDF
      <span className="absolute -right-[3px] -top-[3px] h-3 w-3 rounded-tr-[3px] border-l-[6px] border-t-[6px] border-l-transparent border-t-white/70" />
    </span>
  );
}
