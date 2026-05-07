import { Queue } from "bullmq";
import IORedis, { type RedisOptions } from "ioredis";

// Same trick as lib/db/index.ts: don't throw at module load (next build's
// page-data collection imports route modules before runtime env exists).
// ioredis lazyConnects, so a placeholder is harmless until first command.
const url =
  process.env.REDIS_URL ?? "redis://buildtime:6379/0";

// BullMQ requires maxRetriesPerRequest=null and enableReadyCheck=false
// on the connection used by workers. Use the same options for the queue
// side so a single connection class works in both.
const opts: RedisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
};

export const connection = new IORedis(url, opts);

export const QUEUE_SCRAPE = "scrape";
export const QUEUE_STITCH = "stitch";
export const QUEUE_SCHEDULE = "schedule";
export const QUEUE_PLAN = "plan";

export const scrapeQueue = new Queue(QUEUE_SCRAPE, { connection });
export const stitchQueue = new Queue(QUEUE_STITCH, { connection });
export const scheduleQueue = new Queue(QUEUE_SCHEDULE, { connection });
export const planQueue = new Queue(QUEUE_PLAN, { connection });
