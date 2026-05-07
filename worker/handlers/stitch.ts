import type { Job } from "bullmq";
import path from "node:path";
import { stat } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { downloadVideo } from "@/lib/scraper/apify";
import {
  normalizeAndKeep,
  normalizeToSpec,
  concatNormalized,
} from "@/lib/stitch/ffmpeg";
import {
  ensureProjectDirs,
  projectDir,
  sourcePath,
  stitchedPath,
  ctaNormalizedPath,
} from "@/lib/storage/paths";
import type { StitchJobData } from "@/lib/queue/jobs";

const KEEP_SECONDS = 5;

async function fileExists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pipeline per clip:
 *   1. Download source short via yt-dlp.
 *   2. Keep only first KEEP_SECONDS + re-encode to canonical 1080×1920.
 *   3. Ensure CTA is normalized (cached after first run per project).
 *   4. Concat trimmed-source + CTA via ffmpeg concat demuxer.
 */
export async function handleStitch(job: Job<StitchJobData>) {
  const { clipId } = job.data;

  const [clip] = await db
    .select()
    .from(schema.clips)
    .where(eq(schema.clips.id, clipId));
  if (!clip) throw new Error(`clip ${clipId} not found`);

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, clip.projectId));
  if (!project) throw new Error(`project ${clip.projectId} not found`);
  if (!project.ctaVideoPath) {
    throw new Error("project has no CTA video uploaded");
  }

  await ensureProjectDirs(project.id);

  // 1. Download source
  await db
    .update(schema.clips)
    .set({ status: "downloading", error: null })
    .where(eq(schema.clips.id, clip.id));
  const src = sourcePath(project.id, clip.ytVideoId);
  if (!(await fileExists(src))) {
    await downloadVideo(clip.ytVideoId, src);
  }
  await db
    .update(schema.clips)
    .set({ status: "downloaded", sourcePath: src })
    .where(eq(schema.clips.id, clip.id));

  // 2. Trim + normalize source to a temp file in the stitched dir
  await db
    .update(schema.clips)
    .set({ status: "stitching" })
    .where(eq(schema.clips.id, clip.id));

  const trimmed = path.join(
    projectDir(project.id),
    "stitched",
    `${clip.ytVideoId}.trimmed.mp4`,
  );
  await normalizeAndKeep(src, trimmed, KEEP_SECONDS);

  // 3. Normalize CTA (cached)
  const ctaNorm = ctaNormalizedPath(project.id);
  if (!(await fileExists(ctaNorm))) {
    const rawCta = path.join(projectDir(project.id), project.ctaVideoPath);
    await normalizeToSpec(rawCta, ctaNorm);
  }

  // 4. Concat
  const out = stitchedPath(project.id, clip.ytVideoId);
  await concatNormalized([trimmed, ctaNorm], out);

  await db
    .update(schema.clips)
    .set({ status: "ready", stitchedPath: out })
    .where(eq(schema.clips.id, clip.id));

  console.log(`[stitch] clip=${clip.id} ready -> ${out}`);
  return { stitchedPath: out };
}
