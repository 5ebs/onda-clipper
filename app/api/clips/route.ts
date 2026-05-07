import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");

  // Scope to projects owned by the caller.
  const owned = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.ownerUid, session.uid));
  const ownedIds = owned.map((p) => p.id);
  if (ownedIds.length === 0) return NextResponse.json({ clips: [] });

  const whereParts = [inArray(schema.clips.projectId, ownedIds)];
  if (projectId && ownedIds.includes(projectId)) {
    whereParts.push(eq(schema.clips.projectId, projectId));
  }
  if (
    status &&
    ["scraped", "downloading", "downloaded", "stitching", "ready", "failed"].includes(
      status,
    )
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    whereParts.push(eq(schema.clips.status, status as any));
  }

  const rows = await db
    .select()
    .from(schema.clips)
    .where(and(...whereParts))
    .orderBy(desc(schema.clips.viewCount), desc(schema.clips.createdAt))
    .limit(500);

  return NextResponse.json({ clips: rows });
}
