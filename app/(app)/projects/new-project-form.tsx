"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channelHandle, setChannelHandle] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setIconFile(f);
    setIconPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          channelHandle: channelHandle || undefined,
        }),
      });
      if (!res.ok) {
        setError("Failed to create app");
        return;
      }
      const { project } = (await res.json()) as { project: { id: string } };
      if (iconFile) {
        const fd = new FormData();
        fd.append("file", iconFile);
        await fetch(`/api/projects/${project.id}/icon`, {
          method: "POST",
          body: fd,
        });
      }
      router.push(`/projects/${project.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        New app
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 w-full max-w-md"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => iconRef.current?.click()}
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary text-muted-foreground hover:bg-accent transition-colors"
          title="Upload app icon"
        >
          {iconPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iconPreview}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </button>
        <input
          ref={iconRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={pickIcon}
          className="hidden"
        />
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HealthyBuddy"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="handle">Source YouTube channel (optional)</Label>
            <Input
              id="handle"
              value={channelHandle}
              onChange={(e) => setChannelHandle(e.target.value)}
              placeholder="@SomeCreator"
            />
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
