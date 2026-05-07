import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Canonical encode spec. Both segments (trimmed source + CTA) are
 * re-encoded to this exact spec before concat so the seam is
 * sample-accurate and plays cleanly on iOS Safari.
 */
const SPEC = {
  width: 1080,
  height: 1920,
  fps: 30,
  vCodec: "libx264",
  vProfile: "high",
  vLevel: "4.0",
  vCrf: "20",
  vPreset: "veryfast",
  pixFmt: "yuv420p",
  aCodec: "aac",
  aRate: "44100",
  aBitrate: "128k",
  aChannels: "2",
};

/** Re-encode any input video to the canonical 1080×1920 H.264 spec. */
export async function normalizeToSpec(
  input: string,
  output: string,
): Promise<void> {
  const vf = [
    // Letterbox/crop to 9:16 without distortion.
    `scale=${SPEC.width}:${SPEC.height}:force_original_aspect_ratio=increase`,
    `crop=${SPEC.width}:${SPEC.height}`,
    `fps=${SPEC.fps}`,
    `format=${SPEC.pixFmt}`,
  ].join(",");

  await runFfmpeg([
    "-y",
    "-i",
    input,
    "-vf",
    vf,
    "-c:v",
    SPEC.vCodec,
    "-profile:v",
    SPEC.vProfile,
    "-level",
    SPEC.vLevel,
    "-crf",
    SPEC.vCrf,
    "-preset",
    SPEC.vPreset,
    "-pix_fmt",
    SPEC.pixFmt,
    "-c:a",
    SPEC.aCodec,
    "-ar",
    SPEC.aRate,
    "-ac",
    SPEC.aChannels,
    "-b:a",
    SPEC.aBitrate,
    "-movflags",
    "+faststart",
    output,
  ]);
}

/** Re-encode + keep only the first `keepSec` seconds of the source. */
export async function normalizeAndKeep(
  input: string,
  output: string,
  keepSec: number,
): Promise<void> {
  const vf = [
    `scale=${SPEC.width}:${SPEC.height}:force_original_aspect_ratio=increase`,
    `crop=${SPEC.width}:${SPEC.height}`,
    `fps=${SPEC.fps}`,
    `format=${SPEC.pixFmt}`,
  ].join(",");

  await runFfmpeg([
    "-y",
    "-i",
    input,
    "-t",
    String(keepSec),
    "-vf",
    vf,
    "-c:v",
    SPEC.vCodec,
    "-profile:v",
    SPEC.vProfile,
    "-level",
    SPEC.vLevel,
    "-crf",
    SPEC.vCrf,
    "-preset",
    SPEC.vPreset,
    "-pix_fmt",
    SPEC.pixFmt,
    "-c:a",
    SPEC.aCodec,
    "-ar",
    SPEC.aRate,
    "-ac",
    SPEC.aChannels,
    "-b:a",
    SPEC.aBitrate,
    "-movflags",
    "+faststart",
    output,
  ]);
}

/**
 * Concat two normalized mp4s using the concat demuxer. Both inputs MUST
 * already match SPEC — call normalizeToSpec on the CTA and
 * normalizeAndKeep on the source first. Stream-copy so the seam is
 * sample-accurate.
 */
export async function concatNormalized(
  inputs: string[],
  output: string,
): Promise<void> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "clipper-"));
  try {
    const list = inputs
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    const listFile = path.join(tmp, "list.txt");
    await writeFile(listFile, list, "utf-8");

    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      output,
    ]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = process.env.FFMPEG_PATH ?? "ffmpeg";
    // Same slim-env trick as runYtDlp — the worker's full env overflows
    // Windows' 32KB env block and ffmpeg.exe bails with 0xC0000142 (DLL
    // init failure) before any code runs.
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: minimalEnv(),
    });
    let stderr = "";
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

function minimalEnv(): NodeJS.ProcessEnv {
  const keep = [
    "PATH",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "ComSpec",
    "PATHEXT",
    "NODE_ENV",
  ];
  const out: Record<string, string | undefined> = {};
  for (const k of keep) out[k] = process.env[k];
  return out as NodeJS.ProcessEnv;
}
