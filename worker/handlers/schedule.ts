import type { Job } from "bullmq";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  uploadMedia,
  createPost,
  listAccounts,
  type PostEntry,
} from "@/lib/postiz/client";
import type { ScheduleJobData } from "@/lib/queue/jobs";

/**
 * Push a stitched clip to Postiz as a scheduled post on every chosen
 * account. Postiz handles the per-platform OAuth + rate limiting.
 *
 * Each account → one Post entry with platform-specific `settings`. We
 * resolve `accountId → platform identifier` from `/integrations`.
 */
export async function handleSchedule(job: Job<ScheduleJobData>) {
  const { scheduleId } = job.data;

  const [schedule] = await db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.id, scheduleId));
  if (!schedule) throw new Error(`schedule ${scheduleId} not found`);

  const [clip] = await db
    .select()
    .from(schema.clips)
    .where(eq(schema.clips.id, schedule.clipId));
  if (!clip) throw new Error(`clip ${schedule.clipId} not found`);
  if (clip.status !== "ready" || !clip.stitchedPath) {
    throw new Error(`clip ${clip.id} not ready (status=${clip.status})`);
  }

  // Resolve each accountId → platform identifier (tiktok/instagram/youtube/...).
  const accounts = await listAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const targets = schedule.postizAccountIds
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  if (targets.length === 0) {
    throw new Error(
      `no Postiz accounts resolved for schedule ${schedule.id}`,
    );
  }

  // 1. Upload the stitched mp4 once; Postiz fans out the same media to
  //    every integration in this request.
  const buffer = await readFile(clip.stitchedPath);
  const filename = path.basename(clip.stitchedPath);
  const media = await uploadMedia({
    buffer,
    filename,
    contentType: "video/mp4",
  });

  // 2. Create the scheduled post — one PostEntry per account.
  const posts: PostEntry[] = targets.map((a) => ({
    accountId: a.id,
    platform: a.identifier,
    caption: schedule.caption ?? "",
    mediaPath: media.path,
  }));

  const created = await createPost({
    posts,
    scheduledAt: schedule.scheduledAt,
  });

  await db
    .update(schema.schedules)
    .set({ status: "sent", postizPostId: created.id, error: null })
    .where(eq(schema.schedules.id, schedule.id));

  console.log(
    `[schedule] schedule=${schedule.id} -> postiz=${created.id} ` +
      `accounts=${targets.length} at=${schedule.scheduledAt.toISOString()}`,
  );
  return { postizPostId: created.id };
}
