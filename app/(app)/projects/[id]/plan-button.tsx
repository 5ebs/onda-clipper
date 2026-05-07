"use client";

import { useEffect, useState } from "react";
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

export function PlanButton({
  projectId,
  defaultPerDay,
  defaultTimes,
  activePlan,
}: {
  projectId: string;
  defaultPerDay: number;
  defaultTimes: string[];
  activePlan: PlanRow | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [startDate, setStartDate] = useState(tomorrowISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh the page while a plan is preparing/scheduling so the
  // progress bar updates without manual reload.
  useEffect(() => {
    if (!activePlan) return;
    if (activePlan.status === "scheduled" || activePlan.status === "failed") {
      return;
    }
    const t = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(t);
  }, [activePlan, router]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          days: parseInt(days, 10),
          perDay: defaultPerDay,
          startDate,
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

  if (activePlan) {
    return (
      <PlanProgress plan={activePlan} />
    );
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
            We'll scrape, stitch, and schedule {defaultPerDay} clips per day
            ({defaultTimes.join(", ")}) starting on the chosen date. You can
            close this tab — the worker will keep running.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="days">Days</Label>
              <Input
                id="days"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
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
            <p className="text-xs text-muted-foreground">
              Total clips: {parseInt(days, 10) * defaultPerDay || 0} · times{" "}
              {defaultTimes.join(", ")}
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy}>
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
