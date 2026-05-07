import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  channelHandle: z.string().min(1).max(120).optional(),
  defaultCaption: z.string().max(2200).optional(),
  defaultHashtags: z.string().max(500).optional(),
});

export async function GET() {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.ownerUid, session.uid))
    .orderBy(desc(schema.projects.createdAt));
  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const [row] = await db
    .insert(schema.projects)
    .values({
      ownerUid: session.uid,
      name: parsed.data.name,
      channelHandle: parsed.data.channelHandle,
      defaultCaption: parsed.data.defaultCaption,
      defaultHashtags: parsed.data.defaultHashtags,
    })
    .returning();
  return NextResponse.json({ project: row }, { status: 201 });
}
