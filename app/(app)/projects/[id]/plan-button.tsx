"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PlanRow = {
  id: string;
  days: number;
  perDay: number;
  times: string[];
  startDate: string;
  status: "preparing" | "scheduling" | "scheduled" | "failed";
  scheduledCount: number;
  error: string | null;
};

type Channel = { handle: string; count: number };

function prettyChannel(handle: string) {
  return handle
    .replace(/^https?:\/\/(www\.)?youtube\.com\//, "")
    .replace(/\/shorts\/?$/, "")
    .replace(/\/$/, "");
}

export function PlanButton({
  projectId,
  defaultPerDay,
  defaultTimes,
  availableChannels,
  activePlan,
}: {
  projectId: string;
  defaultPerDay: number;
  defaultTimes: string[];
  availableChannels: Channel[];
  activePlan: PlanRow | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [startDate, setStartDate] = useState(tomorrowISO());
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    () => new Set(availableChannels.map((c) => c.handle)),
  );
  const [skipScrape, setSkipScrape] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activePlan) return;
    if (activePlan.status === "scheduled" || activePlan.status === "failed") {
      return;
    }
    const t = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(t);
  }, [activePlan, router]);

  const available = useMemo(
    () =>
      selectedChannels.size > 0
        ? availableChannels
            .filter((c) => selectedChannels.has(c.handle))
            .reduce((s, c) => s + c.count, 0)
        : availableChannels.reduce((s, c) => s + c.count, 0),
    [selectedChannels, availableChannels],
  );
  const need = parseInt(days, 10) * defaultPerDay || 0;
  const shortBy = Math.max(0, need - available);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const allSelected =
        selectedChannels.size === availableChannels.length;
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          days: parseInt(days, 10),
          perDay: defaultPerDay,
          startDate,
          sourceChannels: allSelected
            ? undefined
            : Array.from(selectedChannels),
          skipScrape,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? j.error ?? "Plan failed");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleChannel(handle: string) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }

  if (activePlan) {
    return <PlanProgress plan={activePlan} />;
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <CalendarDays className="h-4 w-4" />
        Plan {days} days
      </Button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h2 className="text-base font-medium">Plan</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll schedule {defaultPerDay} clips per day (
            {defaultTimes.join(", ")}) from the channels you pick.
          </p>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="days">Days</Label>
                <Input
                  id="days"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={days}
                  onChange={(e) =>
                    setDays(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            {availableChannels.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Source channels
                </span>
                <div className="flex flex-col gap-1">
                  {availableChannels.map((c) => {
                    const on = selectedChannels.has(c.handle);
                    return (
                      <button
                        type="button"
                        key={c.handle}
                        onClick={() => toggleChannel(c.handle)}
                        className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors ${
                          on
                            ? "border-ring bg-secondary"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                              on
                                ? "border-ring bg-ring text-background"
                                : "border-border"
                            }`}
                          >
                            {on && (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="h-3 w-3"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          {prettyChannel(c.handle)}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {c.count} ready
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={skipScrape}
                onChange={(e) => setSkipScrape(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background"
              />
              <span>
                Use only existing clips
                <span className="ml-1.5 text-xs text-muted-foreground">
                  (no new scrape — uncheck to also pull fresh from the
                  project default channel)
                </span>
              </span>
            </label>

            <p className="text-xs text-muted-foreground">
              Plan needs{" "}
              <span className="text-foreground tabular-nums">{need}</span>{" "}
              clips · available from selection:{" "}
              <span className="text-foreground tabular-nums">{available}</span>
              {shortBy > 0 && (
                <span className="text-destructive">
                  {" "}
                  · short by {shortBy} (the worker will wait for new
                  clips to land if you leave scrape on)
                </span>
              )}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={
                busy || selectedChannels.size === 0 || parseInt(days, 10) <= 0
              }
            >
              {busy ? "Starting…" : "Start plan"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PlanProgress({ plan }: { plan: PlanRow }) {
  const total = plan.days * plan.perDay;
  const pct = total > 0 ? Math.min(100, (plan.scheduledCount / total) * 100) : 0;
  const inFlight =
    plan.status === "preparing" || plan.status === "scheduling";
  const heading =
    plan.status === "preparing"
      ? "Preparing clips"
      : plan.status === "scheduling"
        ? "Scheduling"
        : plan.status === "scheduled"
          ? "Scheduled"
          : "Plan failed";
  const sub =
    plan.status === "failed"
      ? plan.error ?? "Unknown error"
      : `${plan.scheduledCount} of ${total} clips`;
  const dotClass =
    plan.status === "failed"
      ? "bg-destructive"
      : plan.status === "scheduled"
        ? "bg-success"
        : "bg-success animate-pulse";
  const barClass =
    plan.status === "failed" ? "bg-destructive" : "bg-success";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium leading-none">{heading}</span>
            <span className="text-xs text-muted-foreground">{sub}</span>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          starts {new Date(plan.startDate).toLocaleDateString()}
        </span>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full ${barClass} ${inFlight ? "transition-[width] duration-500" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
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
        className="relative flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-5"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
