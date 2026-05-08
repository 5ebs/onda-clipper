import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

/**
 * List schedules for a project, joined with clip metadata for the UI.
 * Sorted by `scheduled_at` ASC so the next-up post is on top.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.ownerUid, session.uid),
      ),
    );
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: schema.schedules.id,
      clipId: schema.schedules.clipId,
      scheduledAt: schema.schedules.scheduledAt,
      status: schema.schedules.status,
      postizPostId: schema.schedules.postizPostId,
      platforms: schema.schedules.platforms,
      caption: schema.schedules.caption,
      error: schema.schedules.error,
      ytVideoId: schema.clips.ytVideoId,
      title: schema.clips.title,
      thumbnailUrl: schema.clips.thumbnailUrl,
    })
    .from(schema.schedules)
    .innerJoin(schema.clips, eq(schema.schedules.clipId, schema.clips.id))
    .where(eq(schema.clips.projectId, id))
    .orderBy(asc(schema.schedules.scheduledAt));

  return NextResponse.json({ schedules: rows });
}
