"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

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
};

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  "instagram-standalone": "Instagram",
  youtube: "YouTube",
};

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

type Filter = "all" | "pending" | "sent" | "failed";

export function SchedulesPanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ScheduleRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
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
    // Live-refresh every 10s while looking at the panel.
    const t = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [projectId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (rows === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No schedules yet — kick off a Plan above.
      </p>
    );
  }

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    sent: rows.filter((r) => r.status === "sent").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 text-xs">
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
            <span className="ml-1.5 tabular-nums opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex h-12 w-9 shrink-0 overflow-hidden rounded-sm bg-secondary">
              {r.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              <p className="text-sm line-clamp-1 leading-tight">
                {r.title ?? r.ytVideoId}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatWhen(r.scheduledAt)}</span>
                <span>·</span>
                <span>
                  {(r.platforms ?? [])
                    .map((p) => PLATFORM_LABEL[p] ?? p)
                    .join(", ")}
                </span>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] font-medium ${statusTone(r.status)}`}
            >
              <span className="dot h-1.5 w-1.5 rounded-full" />
              {r.status}
            </span>

            {r.postizPostId && (
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
        ))}
      </div>
    </div>
  );
}
