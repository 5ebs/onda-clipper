import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

/**
 * Stream the stitched mp4 of a clip. Auth-gated: only the project owner
 * can read it. Range-aware so the browser can seek without buffering the
 * whole file.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [row] = await db
    .select({
      stitchedPath: schema.clips.stitchedPath,
      ownerUid: schema.projects.ownerUid,
      title: schema.clips.title,
      ytVideoId: schema.clips.ytVideoId,
    })
    .from(schema.clips)
    .innerJoin(
      schema.projects,
      eq(schema.clips.projectId, schema.projects.id),
    )
    .where(
      and(
        eq(schema.clips.id, id),
        eq(schema.projects.ownerUid, session.uid),
      ),
    );

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!row.stitchedPath) {
    return NextResponse.json({ error: "not_ready" }, { status: 409 });
  }

  let stat;
  try {
    stat = statSync(row.stitchedPath);
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 410 });
  }
  const size = stat.size;

  const range = req.headers.get("range");
  const filename = `${row.ytVideoId}.mp4`;
  const baseHeaders: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) {
      return new Response("invalid range", { status: 416 });
    }
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? parseInt(m[2], 10) : size - 1;
    if (start >= size || end >= size || start > end) {
      return new Response("range out of bounds", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const chunk = createReadStream(row.stitchedPath, { start, end });
    return new Response(Readable.toWeb(chunk) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = createReadStream(row.stitchedPath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
