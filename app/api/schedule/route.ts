import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { scheduleQueue } from "@/lib/queue";
import type { ScheduleJobData } from "@/lib/queue/jobs";

const Body = z.object({
  clipIds: z.array(z.string().uuid()).min(1).max(500),
  postizAccountIds: z.array(z.string().min(1)).min(1).max(20),
  platforms: z.array(z.enum(["tiktok", "instagram", "youtube"])).min(1),
  caption: z.string().max(2200).optional(),
  startAt: z.string().datetime(),
  staggerMinutes: z.number().int().min(0).max(1440).default(15),
});

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { clipIds, postizAccountIds, platforms, caption, startAt, staggerMinutes } =
    parsed.data;

  // Scope: clips must belong to a project owned by the caller AND be ready.
  const rows = await db
    .select({ clip: schema.clips, ownerUid: schema.projects.ownerUid })
    .from(schema.clips)
    .innerJoin(schema.projects, eq(schema.clips.projectId, schema.projects.id))
    .where(
      and(
        inArray(schema.clips.id, clipIds),
        eq(schema.projects.ownerUid, session.uid),
      ),
    );

  const ownedClips = rows.map((r) => r.clip).filter((c) => c.status === "ready");
  if (ownedClips.length === 0) {
    return NextResponse.json({ error: "no_ready_clips" }, { status: 400 });
  }

  const created: { id: string; scheduledAt: string }[] = [];
  let cursor = new Date(startAt).getTime();
  const stepMs = staggerMinutes * 60_000;

  for (const clip of ownedClips) {
    const scheduledAt = new Date(cursor);
    const [row] = await db
      .insert(schema.schedules)
      .values({
        clipId: clip.id,
        platforms,
        postizAccountIds,
        caption: caption ?? null,
        scheduledAt,
        status: "pending",
      })
      .returning();
    const data: ScheduleJobData = { scheduleId: row.id };
    await scheduleQueue.add("schedule", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 200,
      removeOnFail: 200,
    });
    created.push({ id: row.id, scheduledAt: scheduledAt.toISOString() });
    cursor += stepMs;
  }

  return NextResponse.json({ created }, { status: 202 });
}
