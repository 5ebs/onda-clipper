import path from "node:path";
import { mkdir } from "node:fs/promises";

const ROOT = process.env.STORAGE_ROOT || "./storage";

export const STORAGE_ROOT = path.resolve(ROOT);

export function projectDir(projectId: string) {
  return path.join(STORAGE_ROOT, "projects", projectId);
}

export function ctaPath(projectId: string, ext: string) {
  return path.join(projectDir(projectId), `cta.${ext}`);
}

export function iconPath(projectId: string, ext: string) {
  return path.join(projectDir(projectId), `icon.${ext}`);
}

export function ctaNormalizedPath(projectId: string) {
  // The CTA gets re-encoded once on upload to the canonical 1080×1920
  // H.264 spec so concat with stitched clips is sample-accurate.
  return path.join(projectDir(projectId), "cta-normalized.mp4");
}

export function sourcePath(projectId: string, ytVideoId: string) {
  return path.join(projectDir(projectId), "source", `${ytVideoId}.mp4`);
}

export function stitchedPath(projectId: string, ytVideoId: string) {
  return path.join(projectDir(projectId), "stitched", `${ytVideoId}.mp4`);
}

export async function ensureDir(p: string) {
  await mkdir(p, { recursive: true });
}

export async function ensureProjectDirs(projectId: string) {
  await ensureDir(path.join(projectDir(projectId), "source"));
  await ensureDir(path.join(projectDir(projectId), "stitched"));
}
