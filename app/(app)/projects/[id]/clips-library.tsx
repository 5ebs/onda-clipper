"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Play, Trash2, X } from "lucide-react";
import type { Clip } from "@/lib/db/schema";

const STATUS_LABEL: Record<Clip["status"], string> = {
  scraped: "Queued",
  downloading: "Downloading",
  downloaded: "Downloaded",
  stitching: "Stitching",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_TONE: Record<Clip["status"], string> = {
  scraped: "text-muted-foreground bg-secondary",
  downloading: "text-muted-foreground bg-secondary",
  downloaded: "text-muted-foreground bg-secondary",
  stitching: "text-muted-foreground bg-secondary",
  ready: "text-success-foreground bg-success/15 [&_span:first-child]:bg-success",
  failed: "text-destructive bg-destructive/15 [&_span:first-child]:bg-destructive",
};

function StatusPill({ status }: { status: Clip["status"] }) {
  const inFlight =
    status === "downloading" ||
    status === "stitching" ||
    status === "downloaded";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] font-medium ${STATUS_TONE[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-muted-foreground ${
          inFlight ? "animate-pulse" : ""
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatViews(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ClipsLibrary({ clips }: { clips: Clip[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllReady() {
    setSelected(
      new Set(clips.filter((c) => c.status === "ready").map((c) => c.id)),
    );
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteClip(id: string) {
    await fetch(`/api/clips/${id}`, { method: "DELETE" });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    startTransition(() => router.refresh());
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} clip${ids.length === 1 ? "" : "s"}?`)) {
      return;
    }
    await Promise.all(
      ids.map((id) => fetch(`/api/clips/${id}`, { method: "DELETE" })),
    );
    setSelected(new Set());
    startTransition(() => router.refresh());
  }

  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
        <Play className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No clips yet — they appear here once a scrape lands.
        </p>
      </div>
    );
  }

  const selectedClips = clips.filter((c) => selected.has(c.id));
  const allSelectedReady =
    selectedClips.length > 0 &&
    selectedClips.every((c) => c.status === "ready");
  const readyCount = clips.filter((c) => c.status === "ready").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={selectAllReady}
          disabled={readyCount === 0}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Select all ready ({readyCount})
        </button>
        {selected.size > 0 && (
          <button
            onClick={clearSelection}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {clips.map((c) => {
          const isSelected = selected.has(c.id);
          const canSelect = c.status === "ready";
          return (
            <div
              key={c.id}
              className={`group relative overflow-hidden rounded-md border ${
                isSelected ? "border-ring ring-1 ring-ring" : "border-border"
              }`}
            >
              <button
                onClick={() => canSelect && toggle(c.id)}
                disabled={!canSelect}
                className={`block w-full text-left ${
                  !canSelect ? "cursor-default" : "cursor-pointer"
                }`}
              >
                <div className="relative aspect-[9/16] bg-muted">
                  {c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnailUrl}
                      alt={c.title ?? c.ytVideoId}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  {isSelected && (
                    <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 p-2.5 text-xs">
                  <p className="line-clamp-2 leading-snug">
                    {c.title ?? c.ytVideoId}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground tabular-nums">
                      {formatViews(c.viewCount)} views
                    </span>
                    <StatusPill status={c.status} />
                  </div>
                </div>
              </button>

              {c.status === "ready" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewClip(c);
                  }}
                  title="Preview"
                  className="absolute left-1/2 top-[calc(50%-1.75rem)] flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                >
                  <Play className="h-4 w-4 fill-current" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteClip(c.id);
                }}
                title="Delete clip"
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 mt-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm">
            {selected.size} selected
            {!allSelectedReady && (
              <span className="ml-2 text-xs text-muted-foreground">
                (only ready clips can be scheduled)
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={deleteSelected}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <a
              href={
                allSelectedReady
                  ? `/schedule?ids=${Array.from(selected).join(",")}`
                  : "#"
              }
              aria-disabled={!allSelectedReady}
              onClick={(e) => {
                if (!allSelectedReady) e.preventDefault();
              }}
              className={`inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 ${
                !allSelectedReady ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              Schedule {selected.size}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {previewClip && (
        <PreviewModal
          clip={previewClip}
          onClose={() => setPreviewClip(null)}
        />
      )}
    </div>
  );
}

function PreviewModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
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
          src={`/api/clips/${clip.id}/file`}
          controls
          autoPlay
          className="max-h-[80vh] rounded-md border border-border bg-black"
          style={{ aspectRatio: "9/16" }}
        />
        <p className="text-sm text-muted-foreground line-clamp-1">
          {clip.title ?? clip.ytVideoId}
        </p>
      </div>
    </div>
  );
}
