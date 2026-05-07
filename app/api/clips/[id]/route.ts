import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

async function ownClip(clipId: string, uid: string) {
  const [row] = await db
    .select({
      clip: schema.clips,
      ownerUid: schema.projects.ownerUid,
    })
    .from(schema.clips)
    .innerJoin(schema.projects, eq(schema.clips.projectId, schema.projects.id))
    .where(and(eq(schema.clips.id, clipId), eq(schema.projects.ownerUid, uid)));
  return row?.clip ?? null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;
  const clip = await ownClip(id, session.uid);
  if (!clip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.delete(schema.clips).where(eq(schema.clips.id, id));
  return NextResponse.json({ ok: true });
}
