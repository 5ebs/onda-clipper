import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { scrapeQueue } from "@/lib/queue";
import type { ScrapeJobData } from "@/lib/queue/jobs";

const Body = z.object({
  channelHandle: z.string().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(1000).default(30),
  minViews: z.number().int().min(0).optional(),
});

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

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const handle = parsed.data.channelHandle ?? project.channelHandle;
  if (!handle) {
    return NextResponse.json(
      { error: "channel_handle_required" },
      { status: 400 },
    );
  }

  if (parsed.data.channelHandle && parsed.data.channelHandle !== project.channelHandle) {
    await db
      .update(schema.projects)
      .set({ channelHandle: parsed.data.channelHandle })
      .where(eq(schema.projects.id, id));
  }

  const data: ScrapeJobData = {
    projectId: id,
    channelHandle: handle,
    limit: parsed.data.limit,
    minViews: parsed.data.minViews,
  };
  const job = await scrapeQueue.add("scrape", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
