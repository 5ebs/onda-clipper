import { db, schema } from "@/lib/db";
import { stitchQueue } from "@/lib/queue";
import { ne, eq } from "drizzle-orm";

async function main() {
  // Drain any stuck failed jobs in the queue first.
  const failedJobs = await stitchQueue.getFailed(0, 1000);
  for (const j of failedJobs) await j.remove();
  console.log(`drained ${failedJobs.length} failed stitch jobs`);

  // Re-enqueue every clip that hasn't reached ready.
  const stuck = await db
    .select({ id: schema.clips.id, ytVideoId: schema.clips.ytVideoId })
    .from(schema.clips)
    .where(ne(schema.clips.status, "ready"));

  console.log(`stuck clips: ${stuck.length}`);
  for (const c of stuck) {
    await stitchQueue.add(
      "stitch",
      { clipId: c.id },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    );
    await db
      .update(schema.clips)
      .set({ status: "scraped", error: null })
      .where(eq(schema.clips.id, c.id));
    console.log(`  re-enqueued ${c.ytVideoId}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
