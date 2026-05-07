import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { projectDir } from "@/lib/storage/paths";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [project] = await db
    .select({ iconPath: schema.projects.iconPath })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.ownerUid, session.uid),
      ),
    );
  if (!project?.iconPath) {
    return NextResponse.json({ error: "no_icon" }, { status: 404 });
  }

  const file = path.join(projectDir(id), project.iconPath);
  let stat;
  try {
    stat = statSync(file);
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 410 });
  }

  const mime = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const stream = createReadStream(file);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=60",
    },
  });
}
