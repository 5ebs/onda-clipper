"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";

export function CtaPreviewButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Play className="h-3 w-3 fill-current" />
        Preview
      </button>
      {open && (
        <PreviewModal projectId={projectId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function PreviewModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col gap-3 max-h-full"
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <video
          src={`/api/projects/${projectId}/cta/file`}
          controls
          autoPlay
          className="max-h-[80vh] rounded-md border border-border bg-black"
          style={{ aspectRatio: "9/16" }}
        />
        <p className="text-sm text-muted-foreground">CTA video</p>
      </div>
    </div>
  );
}
