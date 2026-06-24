"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFileSelected?: (file: File | null) => void;
}

export function FileDropzone({ onFileSelected }: FileDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFile(f: File | null) {
    setFile(f);
    onFileSelected?.(f);
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-4">
        <FileText className="size-8 shrink-0 text-primary" />
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
        </div>
        <button
          type="button"
          onClick={() => selectFile(null)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) selectFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary/50 hover:bg-muted",
        dragging && "border-primary bg-primary/5",
      )}
    >
      <Upload className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Drag and drop an invoice, or click to browse</p>
      <p className="text-xs text-muted-foreground">PDF, PNG, or JPG up to 10MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
