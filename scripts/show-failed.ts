import { stitchQueue, scrapeQueue } from "@/lib/queue";

async function main() {
  for (const q of [scrapeQueue, stitchQueue]) {
    const jobs = await q.getFailed(0, 20);
    console.log(`=== ${q.name} failed (${jobs.length}) ===`);
    for (const j of jobs) {
      console.log(`  job=${j.id} data=${JSON.stringify(j.data)}`);
      console.log(`    reason: ${j.failedReason?.slice(0, 600)}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
