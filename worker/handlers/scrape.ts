import type { Job } from "bullmq";
import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listChannelShorts } from "@/lib/scraper/youtube";
import { stitchQueue } from "@/lib/queue";
import type { ScrapeJobData, StitchJobData } from "@/lib/queue/jobs";

/**
 * Discovers shorts on a channel and upserts them into the clips table.
 * Re-scraping the same channel is free: we dedupe on
 * (project_id, yt_video_id) and only enqueue stitch jobs for new ones.
 */
export async function handleScrape(job: Job<ScrapeJobData>) {
  const { projectId, channelHandle, limit, minViews } = job.data;
  console.log(`[scrape] project=${projectId} handle=${channelHandle} limit=${limit}`);

  const items = await listChannelShorts(channelHandle, limit);
  const filtered = minViews
    ? items.filter((i) => (i.viewCount ?? 0) >= minViews)
    : items;

  if (filtered.length === 0) {
    console.log("[scrape] no items matched filters");
    return { found: 0, new: 0 };
  }

  // Find which video ids already exist for this project (dedupe).
  const existing = await db
    .select({ ytVideoId: schema.clips.ytVideoId })
    .from(schema.clips)
    .where(
      and(
        eq(schema.clips.projectId, projectId),
        inArray(
          schema.clips.ytVideoId,
          filtered.map((f) => f.id),
        ),
      ),
    );
  const existingIds = new Set(existing.map((e) => e.ytVideoId));

  const fresh = filtered.filter((f) => !existingIds.has(f.id));
  if (fresh.length === 0) {
    console.log(`[scrape] all ${filtered.length} already in library`);
    return { found: filtered.length, new: 0 };
  }

  const inserted = await db
    .insert(schema.clips)
    .values(
      fresh.map((f) => ({
        projectId,
        ytVideoId: f.id,
        sourceChannel: channelHandle,
        title: f.title,
        viewCount: f.viewCount,
        thumbnailUrl: f.thumbnail,
        durationSec: f.duration,
        status: "scraped" as const,
      })),
    )
    .returning({ id: schema.clips.id });

  // Enqueue stitch jobs for the new ones.
  for (const row of inserted) {
    const data: StitchJobData = { clipId: row.id };
    await stitchQueue.add("stitch", data, {
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 200,
      removeOnFail: 200,
    });
  }

  console.log(
    `[scrape] project=${projectId} found=${filtered.length} new=${inserted.length}`,
  );
  return { found: filtered.length, new: inserted.length };
}
