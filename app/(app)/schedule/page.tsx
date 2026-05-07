import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { ScheduleForm } from "./schedule-form";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireSession();
  const { ids } = await searchParams;
  const clipIds = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const clips =
    clipIds.length > 0
      ? await db
          .select()
          .from(schema.clips)
          .where(inArray(schema.clips.id, clipIds))
      : [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-medium">Schedule</h1>
      {clips.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select clips from a project library, then come back here.
        </p>
      ) : (
        <ScheduleForm clips={clips.map((c) => ({ id: c.id, title: c.title ?? c.ytVideoId }))} />
      )}
    </div>
  );
}
