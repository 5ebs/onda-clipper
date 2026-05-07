"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScrapeForm({
  projectId,
  currentHandle,
}: {
  projectId: string;
  currentHandle: string | null;
}) {
  const router = useRouter();
  const [handle, setHandle] = useState(currentHandle ?? "");
  const [limit, setLimit] = useState("30");
  const [minViews, setMinViews] = useState("0");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const limitN = parseInt(limit, 10);
    const minViewsN = parseInt(minViews, 10);
    if (!Number.isFinite(limitN) || limitN <= 0) {
      setMsg("How many shorts must be a positive number.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/scrape`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelHandle: handle || undefined,
          limit: limitN,
          minViews:
            Number.isFinite(minViewsN) && minViewsN > 0 ? minViewsN : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error ?? "Failed to enqueue scrape");
        return;
      }
      setMsg("Scrape enqueued.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="handle">Channel handle</Label>
        <Input
          id="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@MrBeast"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="limit">How many shorts</Label>
          <Input
            id="limit"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="30"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="minViews">Min views</Label>
          <Input
            id="minViews"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={minViews}
            onChange={(e) => setMinViews(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
          />
        </div>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Enqueuing…" : "Scrape now"}
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}
