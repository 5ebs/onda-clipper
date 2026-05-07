import type { Job } from "bullmq";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { scheduleQueue } from "@/lib/queue";
import type { PlanJobData, ScheduleJobData } from "@/lib/queue/jobs";

const POLL_INTERVAL_MS = 60_000;

/**
 * Watch a plan: when enough clips become ready, fan out into
 * schedule rows + jobs, then mark the plan scheduled. While clips are
 * still being prepared, we throw to make BullMQ retry with backoff.
 */
export async function handlePlan(job: Job<PlanJobData>) {
  const { planId } = job.data;

  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.id, planId));
  if (!plan) throw new Error(`plan ${planId} not found`);
  if (plan.status === "scheduled") return { ok: true, alreadyScheduled: true };

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, plan.projectId));
  if (!project) throw new Error(`project ${plan.projectId} not found`);

  const enabledPlatforms = Object.entries(project.platforms ?? {}).filter(
    ([, cfg]) => cfg?.enabled && cfg.accountIds.length > 0,
  );
  if (enabledPlatforms.length === 0) {
    await fail(plan.id, "no_platforms_enabled");
    return { ok: false };
  }

  const need = plan.days * plan.perDay;
  const ready = await db
    .select()
    .from(schema.clips)
    .where(
      and(
        eq(schema.clips.projectId, plan.projectId),
        eq(schema.clips.status, "ready"),
      ),
    )
    .orderBy(desc(schema.clips.viewCount), desc(schema.clips.createdAt))
    .limit(need);

  // Update progress so the UI can show "x/N ready".
  await db
    .update(schema.plans)
    .set({ scheduledCount: ready.length })
    .where(eq(schema.plans.id, plan.id));

  if (ready.length < need) {
    console.log(
      `[plan] plan=${plan.id} ready=${ready.length}/${need}, polling again`,
    );
    // Throw so BullMQ delays the retry per the job's backoff.
    throw new Error(
      `not enough ready clips: ${ready.length}/${need} — will retry`,
    );
  }

  console.log(
    `[plan] plan=${plan.id} clips=${ready.length} — building schedules`,
  );
  await db
    .update(schema.plans)
    .set({ status: "scheduling" })
    .where(eq(schema.plans.id, plan.id));

  const startDay = startOfDayUTC(plan.startDate);
  const accountIds: string[] = [];
  let firstCaption = "";
  for (const [, cfg] of enabledPlatforms) {
    if (!cfg) continue;
    accountIds.push(...cfg.accountIds);
    if (!firstCaption && cfg.caption) firstCaption = cfg.caption;
  }
  const platforms = enabledPlatforms.map(([k]) => k);
  const dedupedAccountIds = Array.from(new Set(accountIds));

  const scheduledRows: { id: string; scheduledAt: Date }[] = [];
  for (let i = 0; i < ready.length; i++) {
    const clip = ready[i];
    const dayIdx = Math.floor(i / plan.perDay);
    const slotIdx = i % plan.perDay;
    const t = plan.times[slotIdx] ?? "12:00";
    const [hh, mm] = t.split(":").map((s) => parseInt(s, 10));
    const scheduledAt = new Date(startDay);
    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + dayIdx);
    scheduledAt.setUTCHours(hh, mm, 0, 0);

    const caption = renderCaption(firstCaption, clip);
    const [row] = await db
      .insert(schema.schedules)
      .values({
        clipId: clip.id,
        platforms,
        postizAccountIds: dedupedAccountIds,
        caption,
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
    scheduledRows.push({ id: row.id, scheduledAt });
  }

  await db
    .update(schema.plans)
    .set({ status: "scheduled", scheduledCount: scheduledRows.length })
    .where(eq(schema.plans.id, plan.id));

  console.log(
    `[plan] plan=${plan.id} scheduled=${scheduledRows.length} done`,
  );
  return { ok: true, scheduled: scheduledRows.length };
}

function startOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function renderCaption(template: string, clip: typeof schema.clips.$inferSelect): string {
  if (!template) return "";
  return template
    .replace(/\{title\}/g, clip.title ?? "")
    .replace(/\{ytId\}/g, clip.ytVideoId);
}

async function fail(planId: string, reason: string) {
  await db
    .update(schema.plans)
    .set({ status: "failed", error: reason })
    .where(eq(schema.plans.id, planId));
}

export const PLAN_RETRY_INTERVAL_MS = POLL_INTERVAL_MS;
