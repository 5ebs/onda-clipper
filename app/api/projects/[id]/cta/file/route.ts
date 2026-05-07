import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { ctaNormalizedPath, projectDir } from "@/lib/storage/paths";

/**
 * Stream the project's CTA video. Prefers the normalized 1080×1920 H.264
 * version (what gets concatenated onto stitched clips) when available;
 * falls back to the raw upload otherwise. Range-aware.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [project] = await db
    .select({ ctaVideoPath: schema.projects.ctaVideoPath })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.ownerUid, session.uid),
      ),
    );
  if (!project?.ctaVideoPath) {
    return NextResponse.json({ error: "no_cta" }, { status: 404 });
  }

  const normalized = ctaNormalizedPath(id);
  const raw = path.join(projectDir(id), project.ctaVideoPath);
  let chosen: string;
  let stat;
  try {
    stat = statSync(normalized);
    chosen = normalized;
  } catch {
    try {
      stat = statSync(raw);
      chosen = raw;
    } catch {
      return NextResponse.json({ error: "file_missing" }, { status: 410 });
    }
  }
  const size = stat.size;

  const range = req.headers.get("range");
  const baseHeaders: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) return new Response("invalid range", { status: 416 });
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? parseInt(m[2], 10) : size - 1;
    if (start >= size || end >= size || start > end) {
      return new Response("range out of bounds", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const chunk = createReadStream(chosen, { start, end });
    return new Response(Readable.toWeb(chunk) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = createReadStream(chosen);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
