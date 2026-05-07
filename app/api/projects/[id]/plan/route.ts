import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { planQueue, scrapeQueue } from "@/lib/queue";
import type { PlanJobData, ScrapeJobData } from "@/lib/queue/jobs";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const Body = z.object({
  days: z.number().int().min(1).max(60).default(30),
  perDay: z.number().int().min(1).max(6).default(3),
  times: z.array(z.string().regex(TIME_RE)).min(1).max(6).optional(),
  startDate: z.string().date().optional(), // YYYY-MM-DD
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.ownerUid, session.uid),
      ),
    );
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!project.channelHandle) {
    return NextResponse.json(
      { error: "no_source_channel" },
      { status: 400 },
    );
  }
  if (!project.ctaVideoPath) {
    return NextResponse.json({ error: "no_cta" }, { status: 400 });
  }
  const enabled = Object.entries(project.platforms ?? {}).filter(
    ([, cfg]) => cfg?.enabled && cfg.accountIds.length > 0,
  );
  if (enabled.length === 0) {
    return NextResponse.json(
      { error: "no_platforms_configured" },
      { status: 400 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const days = parsed.data.days;
  const perDay = parsed.data.perDay;
  const times =
    parsed.data.times ??
    (project.postingTimes && project.postingTimes.length >= perDay
      ? project.postingTimes.slice(0, perDay)
      : ["09:00", "14:00", "19:00"].slice(0, perDay));
  if (times.length !== perDay) {
    return NextResponse.json(
      { error: "times_count_mismatch", message: `need ${perDay} times` },
      { status: 400 },
    );
  }
  const startDate = parsed.data.startDate
    ? new Date(parsed.data.startDate + "T00:00:00.000Z")
    : nextDayUTC();

  const need = days * perDay;

  // Create the plan row.
  const [plan] = await db
    .insert(schema.plans)
    .values({
      projectId: id,
      days,
      perDay,
      times,
      startDate,
      status: "preparing",
    })
    .returning();

  // Trigger a scrape — pull a generous buffer above the strict need so
  // that minViews filters / dedupe don't leave us short.
  const scrapeData: ScrapeJobData = {
    projectId: id,
    channelHandle: project.channelHandle,
    limit: Math.ceil(need * 1.5),
  };
  await scrapeQueue.add("scrape", scrapeData, {
    attempts: 2,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });

  // Watch the plan: re-runs every minute (via attempt backoff) until
  // there are enough ready clips, then schedules them.
  const planData: PlanJobData = { planId: plan.id };
  await planQueue.add("plan", planData, {
    attempts: 240, // up to 4 hours of polling at 60s
    backoff: { type: "fixed", delay: 60_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
    delay: 5_000, // give the scrape a head start
  });

  return NextResponse.json({ plan }, { status: 202 });
}

function nextDayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
