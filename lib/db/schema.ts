import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";

export const clipStatus = pgEnum("clip_status", [
  "scraped",
  "downloading",
  "downloaded",
  "stitching",
  "ready",
  "failed",
]);

export const scheduleStatus = pgEnum("schedule_status", [
  "pending",
  "sent",
  "failed",
]);

export const planStatus = pgEnum("plan_status", [
  "preparing",
  "scheduling",
  "scheduled",
  "failed",
]);

/**
 * Per-platform configuration. Each platform we publish to gets its own
 * Postiz account list and caption template. The caption supports
 * placeholders: `{title}` (source video title), `{channel}` (source
 * channel handle).
 */
export type PlatformConfig = {
  enabled: boolean;
  accountIds: string[];
  caption: string;
};

export type ProjectPlatforms = {
  tiktok?: PlatformConfig;
  instagram?: PlatformConfig;
  youtube?: PlatformConfig;
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUid: text("owner_uid").notNull(),
    name: text("name").notNull(),
    iconPath: text("icon_path"),
    channelHandle: text("channel_handle"),
    channelId: text("channel_id"),
    ctaVideoPath: text("cta_video_path"),
    /** Per-platform caption + Postiz account selection. */
    platforms: jsonb("platforms").$type<ProjectPlatforms>(),
    /** Default posting times for the auto-plan. e.g. ["09:00","14:00","19:00"]. */
    postingTimes: jsonb("posting_times").$type<string[]>(),
    defaultCaption: text("default_caption"),
    defaultHashtags: text("default_hashtags"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byOwner: index("projects_by_owner").on(t.ownerUid),
  }),
);

/**
 * A "plan" is a one-shot fire-and-forget setup. The user picks an app +
 * source channel + CTA + platforms + start date, and we scrape, stitch,
 * and schedule N clips per day for D days automatically.
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    days: integer("days").notNull(),
    perDay: integer("per_day").notNull(),
    /** Times of day in HH:mm. Length should equal perDay. */
    times: jsonb("times").$type<string[]>().notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    status: planStatus("status").notNull().default("preparing"),
    /** How many clips of `days * perDay` are already scheduled. */
    scheduledCount: integer("scheduled_count").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byProject: index("plans_by_project").on(t.projectId),
    byStatus: index("plans_by_status").on(t.status),
  }),
);

export const clips = pgTable(
  "clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ytVideoId: text("yt_video_id").notNull(),
    title: text("title"),
    viewCount: integer("view_count"),
    thumbnailUrl: text("thumbnail_url"),
    durationSec: integer("duration_sec"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sourcePath: text("source_path"),
    stitchedPath: text("stitched_path"),
    status: clipStatus("status").notNull().default("scraped"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqPerProject: uniqueIndex("clips_project_video_uniq").on(
      t.projectId,
      t.ytVideoId,
    ),
    byProject: index("clips_by_project").on(t.projectId),
    byStatus: index("clips_by_status").on(t.status),
  }),
);

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    postizPostId: text("postiz_post_id"),
    platforms: jsonb("platforms").$type<string[]>().notNull(),
    postizAccountIds: jsonb("postiz_account_ids").$type<string[]>().notNull(),
    caption: text("caption"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: scheduleStatus("status").notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byClip: index("schedules_by_clip").on(t.clipId),
    byStatus: index("schedules_by_status").on(t.status),
    byScheduledAt: index("schedules_by_scheduled_at").on(t.scheduledAt),
  }),
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Clip = typeof clips.$inferSelect;
export type NewClip = typeof clips.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
