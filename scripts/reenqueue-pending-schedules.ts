import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { scheduleQueue } from "@/lib/queue";
import type { ScheduleJobData } from "@/lib/queue/jobs";

async function main() {
  const rows = await db
    .select({ id: schema.schedules.id, scheduledAt: schema.schedules.scheduledAt })
    .from(schema.schedules)
    .where(eq(schema.schedules.status, "pending"));

  console.log(`re-enqueuing ${rows.length} pending schedules...`);

  for (const r of rows) {
    const data: ScheduleJobData = { scheduleId: r.id };
    await scheduleQueue.add("schedule", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: 200,
      removeOnFail: 200,
    });
  }

  console.log(`done. ${rows.length} jobs queued.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
