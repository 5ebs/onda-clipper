"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  PlatformConfig,
  ProjectPlatforms,
} from "@/lib/db/schema";

const PLATFORMS = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram Reels" },
  { key: "youtube", label: "YouTube Shorts" },
] as const;

type Platform = (typeof PLATFORMS)[number]["key"];

type PostizAccount = {
  id: string;
  name: string;
  identifier: string;
  picture?: string | null;
};

const DEFAULT_TIMES = ["09:00", "14:00", "19:00"];

export function PlatformsForm({
  projectId,
  initialPlatforms,
  initialTimes,
}: {
  projectId: string;
  initialPlatforms: ProjectPlatforms | null;
  initialTimes: string[] | null;
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PostizAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [config, setConfig] = useState<ProjectPlatforms>(initialPlatforms ?? {});
  const [times, setTimes] = useState<string[]>(
    initialTimes && initialTimes.length > 0 ? initialTimes : DEFAULT_TIMES,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/postiz/accounts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => setAccountsError("Could not reach Postiz."));
  }, []);

  function ensure(key: Platform): PlatformConfig {
    return (
      config[key] ?? {
        enabled: false,
        accountIds: [],
        caption: "",
      }
    );
  }

  function patch(key: Platform, partial: Partial<PlatformConfig>) {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...ensure(key), ...partial },
    }));
  }

  function toggleAccount(key: Platform, accountId: string) {
    const cur = ensure(key).accountIds;
    const next = cur.includes(accountId)
      ? cur.filter((x) => x !== accountId)
      : [...cur, accountId];
    patch(key, { accountIds: next });
  }

  function setTime(idx: number, value: string) {
    setTimes((prev) => prev.map((t, i) => (i === idx ? value : t)));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platforms: config, postingTimes: times }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error ?? "Save failed");
        return;
      }
      setMsg("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {accountsError ? (
        <p className="text-sm text-destructive">{accountsError}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {PLATFORMS.map(({ key, label }) => {
          const cfg = ensure(key);
          const platformAccounts =
            accounts?.filter((a) => a.identifier === key) ?? [];
          return (
            <div
              key={key}
              className="rounded-md border border-border bg-secondary/30 p-3"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) =>
                    patch(key, { enabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border bg-background"
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
              {cfg.enabled && (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Accounts
                    </span>
                    {accounts === null ? (
                      <p className="text-xs text-muted-foreground">
                        Loading…
                      </p>
                    ) : platformAccounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No {label} accounts in Postiz. Connect one in your
                        Postiz instance first.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {platformAccounts.map((a) => {
                          const on = cfg.accountIds.includes(a.id);
                          return (
                            <button
                              type="button"
                              key={a.id}
                              onClick={() => toggleAccount(key, a.id)}
                              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors ${
                                on
                                  ? "border-ring bg-secondary"
                                  : "border-border hover:bg-accent"
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                                  on
                                    ? "border-ring bg-ring text-background"
                                    : "border-border"
                                }`}
                              >
                                {on && <Check className="h-3 w-3" />}
                              </span>
                              <span className="truncate">{a.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`caption-${key}`}
                      className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      Caption
                    </Label>
                    <textarea
                      id={`caption-${key}`}
                      value={cfg.caption}
                      onChange={(e) => patch(key, { caption: e.target.value })}
                      placeholder="Use {title} for the source video title."
                      rows={3}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Posting times (per day)
        </span>
        <div className="flex flex-wrap gap-2">
          {times.map((t, i) => (
            <input
              key={i}
              type="time"
              value={t}
              onChange={(e) => setTime(i, e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm w-[120px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          ))}
          {times.length < 6 && (
            <button
              type="button"
              onClick={() => setTimes((p) => [...p, "12:00"])}
              className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              + Time
            </button>
          )}
          {times.length > 1 && (
            <button
              type="button"
              onClick={() => setTimes((p) => p.slice(0, -1))}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              Remove last
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
