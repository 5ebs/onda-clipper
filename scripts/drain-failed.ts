import { scrapeQueue, stitchQueue, scheduleQueue } from "@/lib/queue";

async function main() {
  for (const q of [scrapeQueue, stitchQueue, scheduleQueue]) {
    const failed = await q.getFailed(0, 1000);
    for (const j of failed) await j.remove();
    console.log(`drained ${failed.length} failed from ${q.name}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
