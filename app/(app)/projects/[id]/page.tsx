import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ScrapeForm } from "./scrape-form";
import { CtaUploader } from "./cta-uploader";
import { ClipsLibrary } from "./clips-library";
import { PlatformsForm } from "./platforms-form";
import { CtaPreviewButton } from "./cta-preview-button";
import { PlanButton } from "./plan-button";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "destructive";
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-xl font-medium leading-none tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(eq(schema.projects.id, id), eq(schema.projects.ownerUid, session.uid)),
    );
  if (!project) notFound();

  const clips = await db
    .select()
    .from(schema.clips)
    .where(eq(schema.clips.projectId, id))
    .orderBy(desc(schema.clips.viewCount), desc(schema.clips.createdAt))
    .limit(500);

  const [activePlan] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.projectId, id))
    .orderBy(desc(schema.plans.createdAt))
    .limit(1);

  const counts = await db
    .select({
      status: schema.clips.status,
      n: sql<number>`count(*)::int`,
    })
    .from(schema.clips)
    .where(eq(schema.clips.projectId, id))
    .groupBy(schema.clips.status);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n]));
  const ready = byStatus.ready ?? 0;
  const failed = byStatus.failed ?? 0;
  const inFlight =
    (byStatus.scraped ?? 0) +
    (byStatus.downloading ?? 0) +
    (byStatus.downloaded ?? 0) +
    (byStatus.stitching ?? 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
          {project.iconPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/projects/${project.id}/icon/file`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg font-medium text-muted-foreground">
              {project.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-medium truncate leading-tight">
            {project.name}
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {project.channelHandle ? (
              <>
                Sourcing from{" "}
                <span className="text-foreground">{project.channelHandle}</span>
              </>
            ) : (
              <em className="font-serif">No source channel set</em>
            )}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={String(clips.length)} />
        <Stat
          label="Ready"
          value={String(ready)}
          tone={ready > 0 ? "success" : "default"}
        />
        <Stat label="In flight" value={String(inFlight)} />
        <Stat
          label="Failed"
          value={failed > 0 ? String(failed) : "—"}
          tone={failed > 0 ? "destructive" : "default"}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <CardTitle>Source channel</CardTitle>
            <ScrapeForm
              projectId={project.id}
              currentHandle={project.channelHandle}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <CardTitle>CTA video</CardTitle>
              {project.ctaVideoPath && (
                <CtaPreviewButton projectId={project.id} />
              )}
            </div>
            <CtaUploader
              projectId={project.id}
              hasCta={Boolean(project.ctaVideoPath)}
            />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Distribution
        </h2>
        <Card>
          <CardContent className="p-4">
            <PlatformsForm
              projectId={project.id}
              initialPlatforms={project.platforms}
              initialTimes={project.postingTimes}
            />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Auto-publish
        </h2>
        <PlanButton
          projectId={project.id}
          defaultPerDay={(project.postingTimes ?? ["09:00", "14:00", "19:00"]).length}
          defaultTimes={
            project.postingTimes ?? ["09:00", "14:00", "19:00"]
          }
          activePlan={
            activePlan
              ? {
                  id: activePlan.id,
                  days: activePlan.days,
                  perDay: activePlan.perDay,
                  times: activePlan.times,
                  startDate: activePlan.startDate.toISOString(),
                  status: activePlan.status,
                  scheduledCount: activePlan.scheduledCount,
                  error: activePlan.error,
                }
              : null
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Library
        </h2>
        <ClipsLibrary clips={clips} />
      </section>
    </div>
  );
}
