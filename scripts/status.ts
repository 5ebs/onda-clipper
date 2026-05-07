import { db, schema } from "@/lib/db";
import { stitchQueue, scrapeQueue, scheduleQueue } from "@/lib/queue";
import { sql } from "drizzle-orm";

async function main() {
  const counts = await db
    .select({ status: schema.clips.status, n: sql<number>`count(*)::int` })
    .from(schema.clips)
    .groupBy(schema.clips.status);

  console.log("clips by status:");
  for (const r of counts) console.log(`  ${r.status.padEnd(12)} ${r.n}`);

  for (const q of [scrapeQueue, stitchQueue, scheduleQueue]) {
    const c = await q.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
    );
    console.log(`queue ${q.name}:`, c);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
