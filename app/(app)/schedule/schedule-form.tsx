"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Account = {
  id: string;
  name: string;
  identifier: string;
  picture?: string | null;
};

const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
type Platform = (typeof PLATFORMS)[number];

export function ScheduleForm({
  clips,
}: {
  clips: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [pickedAccounts, setPickedAccounts] = useState<Set<string>>(new Set());
  const [platforms, setPlatforms] = useState<Set<Platform>>(
    new Set(["tiktok", "instagram", "youtube"]),
  );
  const [caption, setCaption] = useState("");
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60_000);
    return d.toISOString().slice(0, 16);
  });
  const [staggerMinutes, setStaggerMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/postiz/accounts")
      .then(async (r) => {
        if (!r.ok) {
          setAccounts([]);
          return;
        }
        const j = (await r.json()) as { accounts: Account[] };
        setAccounts(j.accounts);
      })
      .catch(() => setAccounts([]));
  }, []);

  function toggleAccount(id: string) {
    setPickedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clipIds: clips.map((c) => c.id),
          postizAccountIds: Array.from(pickedAccounts),
          platforms: Array.from(platforms),
          caption: caption || undefined,
          startAt: new Date(startAt).toISOString(),
          staggerMinutes,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error ?? "Failed to schedule");
        return;
      }
      const j = (await res.json()) as { created: { id: string }[] };
      setMsg(`Scheduled ${j.created.length} clips. Posts will go out via Postiz.`);
      router.push("/projects");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">
          Selected clips ({clips.length})
        </p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {clips.map((c) => (
            <li key={c.id} className="line-clamp-1">
              {c.title}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Label>Platforms</Label>
        <div className="flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => togglePlatform(p)}
              className={`rounded-md border px-3 py-1 text-sm capitalize ${
                platforms.has(p)
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Postiz accounts</Label>
        {accounts === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No accounts found. Connect them in your Postiz instance first.
          </p>
        ) : (
          <div className="space-y-1">
            {accounts.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={pickedAccounts.has(a.id)}
                  onChange={() => toggleAccount(a.id)}
                />
                <span className="capitalize">{a.identifier}</span>
                <span className="text-muted-foreground">— {a.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="caption">Caption</Label>
        <Textarea
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption + hashtags…"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="startAt">Start at</Label>
          <Input
            id="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="stagger">Stagger (minutes between posts)</Label>
          <Input
            id="stagger"
            type="number"
            min={0}
            max={1440}
            value={staggerMinutes}
            onChange={(e) => setStaggerMinutes(Number(e.target.value))}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={
          busy ||
          pickedAccounts.size === 0 ||
          platforms.size === 0 ||
          clips.length === 0
        }
      >
        {busy ? "Scheduling…" : `Schedule ${clips.length} clips`}
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}
