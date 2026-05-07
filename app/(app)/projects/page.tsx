import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { NewProjectForm } from "./new-project-form";

type ProjectRow = {
  id: string;
  name: string;
  iconPath: string | null;
  channelHandle: string | null;
  ctaVideoPath: string | null;
  totalClips: number;
  readyClips: number;
  activePlanStatus:
    | "preparing"
    | "scheduling"
    | "scheduled"
    | "failed"
    | null;
};

async function loadProjects(uid: string): Promise<ProjectRow[]> {
  const rows = await db.execute(sql`
    select p.id, p.name, p.icon_path, p.channel_handle, p.cta_video_path,
      coalesce(c.total, 0)::int as total_clips,
      coalesce(c.ready, 0)::int as ready_clips,
      pl.status as plan_status
    from ${schema.projects} p
    left join lateral (
      select count(*) as total,
        count(*) filter (where status = 'ready') as ready
      from ${schema.clips}
      where project_id = p.id
    ) c on true
    left join lateral (
      select status from ${schema.plans}
      where project_id = p.id
      order by created_at desc
      limit 1
    ) pl on true
    where p.owner_uid = ${uid}
    order by p.created_at desc
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    iconPath: r.icon_path ? String(r.icon_path) : null,
    channelHandle: r.channel_handle ? String(r.channel_handle) : null,
    ctaVideoPath: r.cta_video_path ? String(r.cta_video_path) : null,
    totalClips: Number(r.total_clips ?? 0),
    readyClips: Number(r.ready_clips ?? 0),
    activePlanStatus:
      (r.plan_status as ProjectRow["activePlanStatus"]) ?? null,
  }));
}

export default async function ProjectsPage() {
  const session = await requireSession();
  const projects = await loadProjects(session.uid);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-medium">Apps</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-serif italic">One app per channel.</span>{" "}
            Scrape, stitch, schedule.
          </p>
        </div>
        <NewProjectForm />
      </header>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No apps yet — create one to start clipping.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <ProjectTile key={p.id} project={p} />
          ))}
        </section>
      )}
    </div>
  );
}

function ProjectTile({ project: p }: { project: ProjectRow }) {
  const planLabel =
    p.activePlanStatus === "preparing"
      ? "Plan running"
      : p.activePlanStatus === "scheduling"
        ? "Plan scheduling"
        : p.activePlanStatus === "scheduled"
          ? "Plan live"
          : p.activePlanStatus === "failed"
            ? "Plan failed"
            : null;

  return (
    <Link
      href={`/projects/${p.id}`}
      className="group flex items-start gap-4 rounded-lg border border-border p-5 transition-colors duration-150 hover:bg-accent"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
        {p.iconPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/projects/${p.id}/icon/file`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-base font-medium text-muted-foreground">
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <h2 className="text-base font-medium truncate leading-tight">
          {p.name}
        </h2>
        <span className="text-sm text-muted-foreground truncate">
          {p.channelHandle ?? (
            <em className="font-serif">No source channel</em>
          )}
        </span>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {p.readyClips}/{p.totalClips} ready
          </span>
          {planLabel && (
            <span className="inline-flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  p.activePlanStatus === "failed"
                    ? "bg-destructive"
                    : p.activePlanStatus === "scheduled"
                      ? "bg-success"
                      : "bg-success animate-pulse"
                }`}
              />
              {planLabel}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
