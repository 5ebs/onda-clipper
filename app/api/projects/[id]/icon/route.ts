import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { ensureProjectDirs, iconPath, projectDir } from "@/lib/storage/paths";

export const runtime = "nodejs";

const ALLOWED_EXTS = new Set(["png", "jpg", "jpeg", "webp", "svg"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.ownerUid, session.uid),
      ),
    );
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: "unsupported_format" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  await ensureProjectDirs(id);
  const dest = iconPath(id, ext);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buf);

  const rel = path.relative(projectDir(id), dest);
  await db
    .update(schema.projects)
    .set({ iconPath: rel })
    .where(eq(schema.projects.id, id));

  return NextResponse.json({ ok: true, path: rel });
}
