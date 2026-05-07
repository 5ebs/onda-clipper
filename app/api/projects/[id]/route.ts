import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

const PlatformConfigSchema = z.object({
  enabled: z.boolean(),
  accountIds: z.array(z.string().min(1)).max(20),
  caption: z.string().max(2200),
});
const PlatformsSchema = z.object({
  tiktok: PlatformConfigSchema.optional(),
  instagram: PlatformConfigSchema.optional(),
  youtube: PlatformConfigSchema.optional(),
});
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  channelHandle: z.string().min(1).max(120).nullable().optional(),
  defaultCaption: z.string().max(2200).nullable().optional(),
  defaultHashtags: z.string().max(500).nullable().optional(),
  platforms: PlatformsSchema.optional(),
  postingTimes: z.array(z.string().regex(TIME_RE)).min(1).max(6).optional(),
});

async function ownProject(id: string, uid: string) {
  const [row] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerUid, uid)));
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;
  const project = await ownProject(id, session.uid);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;
  const project = await ownProject(id, session.uid);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const [row] = await db
    .update(schema.projects)
    .set(parsed.data)
    .where(eq(schema.projects.id, id))
    .returning();
  return NextResponse.json({ project: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;
  const project = await ownProject(id, session.uid);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  return NextResponse.json({ ok: true });
}
