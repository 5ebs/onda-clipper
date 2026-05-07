"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export function CtaUploader({
  projectId,
  hasCta,
}: {
  projectId: string;
  hasCta: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/cta`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error ?? "Upload failed");
        return;
      }
      setMsg("Uploaded.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {hasCta ? "On file. Upload to replace." : "Not uploaded."}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={onChange}
        disabled={busy}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Uploading…" : hasCta ? "Replace video" : "Upload video"}
      </button>
      {fileName && !busy && (
        <p className="truncate text-xs text-muted-foreground">{fileName}</p>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
