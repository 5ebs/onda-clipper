import { Worker } from "bullmq";
import {
  connection,
  QUEUE_SCRAPE,
  QUEUE_STITCH,
  QUEUE_SCHEDULE,
  QUEUE_PLAN,
} from "@/lib/queue";
import { handleScrape } from "./handlers/scrape";
import { handleStitch } from "./handlers/stitch";
import { handleSchedule } from "./handlers/schedule";
import { handlePlan } from "./handlers/plan";

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? "2");

const workers = [
  new Worker(QUEUE_SCRAPE, handleScrape, { connection, concurrency }),
  new Worker(QUEUE_STITCH, handleStitch, { connection, concurrency }),
  // Postiz public API has a NestJS Throttler (~10 req / 60s by default).
  // Serialise + cap at 1 call per 7s so a 90-clip plan doesn't 429 itself
  // out. 90 schedules then take ~10 minutes to fan out — fine for the
  // one-shot Plan flow.
  new Worker(QUEUE_SCHEDULE, handleSchedule, {
    connection,
    concurrency: 1,
    limiter: { max: 1, duration: 7_000 },
  }),
  new Worker(QUEUE_PLAN, handlePlan, { connection, concurrency: 1 }),
];

for (const w of workers) {
  w.on("failed", (job, err) => {
    console.error(`[${w.name}] job=${job?.id} failed:`, err?.message ?? err);
  });
  w.on("error", (err) => {
    console.error(`[${w.name}] error:`, err?.message ?? err);
  });
}

console.log(
  `[worker] up. queues=${QUEUE_SCRAPE},${QUEUE_STITCH},${QUEUE_SCHEDULE},${QUEUE_PLAN} concurrency=${concurrency}`,
);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
