import { NextRequest, NextResponse } from "next/server";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import {
  ctaNormalizedPath,
  ctaPath,
  ensureProjectDirs,
  projectDir,
} from "@/lib/storage/paths";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerUid, session.uid)));
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  if (!["mp4", "mov", "m4v", "webm"].includes(ext)) {
    return NextResponse.json({ error: "unsupported_format" }, { status: 400 });
  }

  await ensureProjectDirs(id);
  const dest = ctaPath(id, ext);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buf);

  // Invalidate cached normalized CTA so the next stitch re-encodes from
  // the just-uploaded raw file. Without this, replacing a CTA reuses the
  // previous one's normalized output silently.
  await rm(ctaNormalizedPath(id), { force: true });

  // We persist the raw upload path; the worker will normalize it to the
  // canonical spec the first time we stitch a clip in this project.
  const rel = path.relative(projectDir(id), dest);
  await db
    .update(schema.projects)
    .set({ ctaVideoPath: rel })
    .where(eq(schema.projects.id, id));

  return NextResponse.json({ ok: true, path: rel });
}
