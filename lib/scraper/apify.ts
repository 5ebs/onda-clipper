import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ACTOR =
  process.env.APIFY_VIDEO_ACTOR ?? "marielise.dev~youtube-video-downloader";
// "360" | "480" | "720" | "1080" — actor's enum, no "p" suffix.
// 720 is the most reliable on the standard (free) path; 1080 hits
// HTTP 403 / bot-detection often unless residential proxy is enabled.
const QUALITY = (process.env.APIFY_VIDEO_QUALITY ?? "720").replace(/p$/, "");
// 1080p downloads need >300s on the actor's standard path. Bump.
const RUN_TIMEOUT_SECS = Number(process.env.APIFY_RUN_TIMEOUT_SECS ?? "600");

/**
 * Run an Apify actor synchronously and return its dataset items.
 * `run-sync-get-dataset-items` blocks until the run finishes.
 */
async function runActor(input: unknown): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const params = new URLSearchParams({
    token,
    timeout: String(RUN_TIMEOUT_SECS),
  });
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?${params}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify ${ACTOR} ${res.status}: ${body.slice(0, 400)}`);
  }
  const items = (await res.json()) as unknown[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Apify ${ACTOR} returned no dataset items`);
  }
  return items;
}

/**
 * Pull a downloadable mp4 URL out of an Apify dataset item.
 * Different actors use different field names — accept the common ones.
 */
function extractDownloadUrl(item: unknown): string {
  if (!item || typeof item !== "object") {
    throw new Error("Apify item not an object");
  }
  const o = item as Record<string, unknown>;
  const candidates = [
    o.downloadUrl,
    o.download_url,
    o.url,
    o.videoUrl,
    o.video_url,
    o.merged_downloadable_link,
    o.best_format,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c)) return c;
  }
  throw new Error(
    `Apify item has no download URL. Keys: ${Object.keys(o).join(",")}`,
  );
}

/** Download a YouTube video by id to `outputPath` via Apify. */
export async function downloadVideo(
  videoId: string,
  outputPath: string,
): Promise<void> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const items = await runActor({
    urls: [{ url }],
    quality: QUALITY,
    format: "default",
  });
  const item = items[0] as Record<string, unknown>;
  if (item.status === "failed") {
    throw new Error(
      `Apify item failed (${item.errorCode ?? ""}): ${String(item.error ?? "")}`,
    );
  }
  const downloadUrl = extractDownloadUrl(item);

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok || !fileRes.body) {
    throw new Error(`Apify download fetch ${fileRes.status}`);
  }
  // Node 22's fetch returns a web ReadableStream; bridge to a Node stream.
  const nodeStream = Readable.fromWeb(
    fileRes.body as Parameters<typeof Readable.fromWeb>[0],
  );
  await pipeline(nodeStream, createWriteStream(outputPath));
}
