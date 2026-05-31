"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Play,
  X,
} from "lucide-react";

type ScheduleRow = {
  id: string;
  clipId: string;
  scheduledAt: string;
  status: "pending" | "sent" | "failed";
  postizPostId: string | null;
  platforms: string[];
  caption: string | null;
  error: string | null;
  ytVideoId: string;
  title: string | null;
  thumbnailUrl: string | null;
  sourceChannel: string | null;
};

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  "instagram-standalone": "Instagram",
  youtube: "YouTube",
};

const COLLAPSED_DEFAULT_THRESHOLD = 10;
const COLLAPSED_PREVIEW_COUNT = 5;

function statusTone(s: ScheduleRow["status"]) {
  return s === "sent"
    ? "text-success-foreground bg-success/15 [&_.dot]:bg-success"
    : s === "failed"
      ? "text-destructive bg-destructive/15 [&_.dot]:bg-destructive"
      : "text-muted-foreground bg-secondary [&_.dot]:bg-muted-foreground";
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyChannel(handle: string | null) {
  if (!handle) return null;
  // strip leading url + trailing /shorts
  return handle
    .replace(/^https?:\/\/(www\.)?youtube\.com\//, "")
    .replace(/\/shorts\/?$/, "")
    .replace(/\/$/, "");
}

type Filter = "all" | "pending" | "sent" | "failed";

export function SchedulesPanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ScheduleRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/projects/${projectId}/schedules`);
        if (!r.ok) throw new Error(`status ${r.status}`);
        const j = (await r.json()) as { schedules: ScheduleRow[] };
        if (!cancelled) setRows(j.schedules);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    load();
    const t = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [projectId]);

  const counts = useMemo(() => {
    if (!rows) return { all: 0, pending: 0, sent: 0, failed: 0 };
    return {
      all: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
    };
  }, [rows]);

  const sourceChannels = useMemo(() => {
    if (!rows) return [];
    const set = new Set<string>();
    for (const r of rows) {
      const c = prettyChannel(r.sourceChannel);
      if (c) set.add(c);
    }
    return Array.from(set);
  }, [rows]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (rows === null)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No schedules yet — kick off a Plan above.
      </p>
    );
  }

  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const showCollapse = filtered.length > COLLAPSED_DEFAULT_THRESHOLD;
  const visible = showCollapse && !expanded
    ? filtered.slice(0, COLLAPSED_PREVIEW_COUNT)
    : filtered;
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
          {(["all", "pending", "sent", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2 py-1 transition-colors ${
                filter === f
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 tabular-nums opacity-60">
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        {sourceChannels.length > 0 && (
          <span className="text-muted-foreground">
            from{" "}
            {sourceChannels.map((c, i) => (
              <span key={c}>
                {i > 0 && ", "}
                <span className="text-foreground font-medium">{c}</span>
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {visible.map((r) => (
          <ScheduleItem
            key={r.id}
            row={r}
            onPreview={() => setPreviewClipId(r.clipId)}
          />
        ))}
      </div>

      {showCollapse && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="self-start inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show all {filtered.length} ({hiddenCount} more)
            </>
          )}
        </button>
      )}

      {previewClipId && (
        <PreviewModal
          clipId={previewClipId}
          onClose={() => setPreviewClipId(null)}
        />
      )}
    </div>
  );
}

function ScheduleItem({
  row,
  onPreview,
}: {
  row: ScheduleRow;
  onPreview: () => void;
}) {
  const channel = prettyChannel(row.sourceChannel);
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors">
      <button
        onClick={onPreview}
        title="Preview clip"
        className="group relative flex h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-secondary"
      >
        {row.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-3.5 w-3.5 fill-current text-foreground" />
        </span>
      </button>

      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <p className="text-sm line-clamp-1 leading-tight">
          {row.title ?? row.ytVideoId}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatWhen(row.scheduledAt)}</span>
          <span>·</span>
          <span>
            {(row.platforms ?? [])
              .map((p) => PLATFORM_LABEL[p] ?? p)
              .join(", ")}
          </span>
          {channel && (
            <>
              <span>·</span>
              <span className="truncate">{channel}</span>
            </>
          )}
        </div>
      </div>

      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] font-medium ${statusTone(row.status)}`}
      >
        <span className="dot h-1.5 w-1.5 rounded-full" />
        {row.status}
      </span>

      {row.postizPostId && (
        <a
          href={`https://posts.ondadev.com/launches`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Postiz"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function PreviewModal({
  clipId,
  onClose,
}: {
  clipId: string;
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
          src={`/api/clips/${clipId}/file`}
          controls
          autoPlay
          className="max-h-[80vh] rounded-md border border-border bg-black"
          style={{ aspectRatio: "9/16" }}
        />
      </div>
    </div>
  );
}
