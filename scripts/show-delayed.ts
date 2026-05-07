import { stitchQueue, scrapeQueue, scheduleQueue } from "@/lib/queue";

async function main() {
  for (const q of [scrapeQueue, stitchQueue, scheduleQueue]) {
    const jobs = await q.getDelayed(0, 50);
    console.log(`=== ${q.name} delayed (${jobs.length}) ===`);
    for (const j of jobs) {
      const next = j.opts.delay ? new Date(j.timestamp + j.opts.delay) : null;
      console.log(
        `  job=${j.id} attempts=${j.attemptsMade}/${j.opts.attempts ?? 1} ` +
          `nextRun=${next?.toISOString() ?? "?"} data=${JSON.stringify(j.data)}`,
      );
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
