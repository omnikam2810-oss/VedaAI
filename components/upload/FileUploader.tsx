"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PdfGlyph } from "@/components/ui/Brand";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

interface FileUploaderProps {
  label: string;
  accent: string;
  file: File | null;
  onFile: (file: File | null) => void;
  error?: string | null;
}

export function FileUploader({ label, accent, file, onFile, error }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function validate(next: File): boolean {
    const ext = next.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "png", "jpg", "jpeg"].includes(ext)) {
      setLocalError("Use a PDF, PNG, JPG, or JPEG file.");
      return false;
    }
    if (next.size > MAX_FILE_BYTES) {
      setLocalError("File exceeds the 10MB limit.");
      return false;
    }
    if (next.size <= 0) {
      setLocalError("The selected file is empty.");
      return false;
    }
    setLocalError(null);
    return true;
  }

  function handleFiles(list: FileList | null) {
    const next = list?.[0];
    if (!next) return;
    if (validate(next)) onFile(next);
  }

  return (
    <div
      className={cn(
        "dashed-zone relative flex min-h-[168px] items-center justify-center rounded-[22px] bg-[#f7f7f7] px-4 py-5 transition",
        dragOver && "bg-[#fff3ee]",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />
      {file ? (
        <div className="relative flex w-full max-w-[280px] items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
          <PdfGlyph />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name.replace(/\.[^.]+$/, "")}</p>
            <p className="text-xs text-[#8b8b8b]">
              {formatBytes(file.size)}
              {file.type.includes("pdf") ? " • PDF" : " • Image"}
            </p>
          </div>
          <button
            type="button"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1c1c1c] text-white"
            aria-label={`Remove ${label}`}
            onClick={() => onFile(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex flex-col items-center gap-2 text-center"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-6 w-6 text-[#9a9a9a]" />
          <p className="text-[15px] font-medium">
            Upload <span className="text-[#ff6b4a]">{accent}</span>
          </p>
          <p className="text-xs text-[#9a9a9a]">Max 10MB</p>
        </button>
      )}
      {(localError || error) && (
        <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-[#ef4444]">{localError || error}</p>
      )}
    </div>
  );
}
