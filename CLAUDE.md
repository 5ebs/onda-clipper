# OndaDev Clipper

Internal tool for OndaDev. Pulls viral YouTube Shorts from a creator handle, stitches our app's CTA on the end, bulk-schedules to TikTok / Instagram Reels / YouTube Shorts via self-hosted Postiz.

Inspired by clip-factory.app — same flow, but Postiz is the publisher (we already host it on the same CPX42).

## Read this before changing anything

1. Read this file fully.
2. Read `README.md` for env setup and local dev.
3. Confirm `.env` has: `DATABASE_URL`, `REDIS_URL`, `FIREBASE_ONDADEV_METRICS_KEY_B64`, the four `NEXT_PUBLIC_FIREBASE_*` values, `POSTIZ_API_URL`, `POSTIZ_API_KEY`, `APIFY_TOKEN`, `STORAGE_ROOT`. If something critical is missing, stop and ask Gianmarco. Never mock or fabricate.

## Stack (non-negotiable)

- Next.js 15, App Router, TypeScript strict
- Tailwind + shadcn/ui (same conventions as `onda-dev`)
- Postgres via Drizzle (NOT Firestore — relational data here: project → clips → schedules)
- BullMQ + Redis for the job queue
- Firebase Auth + allowlist — **shared with `onda-dev`**, hosted in the `ondadev-metrics` Firebase project. Single sign-on across the two tools via `.ondadev.com` cookie domain in prod.
- yt-dlp + ffmpeg in the worker container (system binaries, called via `child_process`). yt-dlp is **listing-only** — channel `/shorts` enumeration. The actual mp4 download goes through **Apify** (see "Why Apify" below).
- Apify for video downloads (`marielise.dev/youtube-video-downloader` actor by default). Bypasses YouTube's rotating cookie + JS-challenge regime via residential proxies.
- Postiz REST API for publishing (no direct TikTok/IG/YT integration here — Postiz owns OAuth + rate limiting)
- Hosting: same CPX42 Hetzner box as Postiz. Two containers: `web` (Next) + `worker` (Node + ffmpeg + yt-dlp). Postgres + Redis as separate services in `docker-compose.yml`.

## Why Apify (and not just yt-dlp)

YouTube actively rotates session cookies and ships a JS "n" challenge that yt-dlp solves via Deno + a remotely-fetched script bundle. In practice this means weekly cookie refreshes from a logged-in browser, plus a Deno install in the worker, plus failures when YouTube ships a new n-sig. Apify handles all of that on their side via residential proxies. We pay ~$1–3/mo for the volumes we run; in exchange the worker becomes a thin HTTP client. Listing the `/shorts` tab does *not* hit the bot challenge, so we keep yt-dlp for that step (free, accurate).

## Architecture

```
[Next.js web]                                 [Postgres]
   │                                              ▲
   │ enqueue jobs                                 │ reads/writes
   ▼                                              │
[Redis (BullMQ)]                                  │
   │                                              │
   ▼                                              │
[Worker (yt-dlp + ffmpeg)]  ──── reads/writes ────┘
   │                              │
   │ list (yt-dlp)                │
   │ download (Apify HTTP)        │ stitch (ffmpeg)
   ▼                              ▼
[Local storage volume: source/, stitched/, cta/]
   │
   └─► uploads stitched mp4 to Postiz ──► TikTok / IG Reels / YT Shorts
```

Hard rule: the web tier never shells out. yt-dlp and ffmpeg are worker-only. Web enqueues, worker processes, web reads results.

## Data model

```
projects
  id, owner_uid, name, channel_handle, channel_id, cta_video_path,
  default_caption, default_hashtags, created_at

clips
  id, project_id, yt_video_id (unique per project for dedupe),
  title, view_count, thumbnail_url, duration_sec, published_at,
  source_path, stitched_path,
  status: scraped | downloading | downloaded | stitching | ready | failed,
  error, created_at

schedules
  id, clip_id, postiz_post_id, platforms[], scheduled_at,
  status: pending | sent | failed, error, created_at
```

`projects.cta_video_path` is the single CTA per project (one upload, reused across every stitched clip in that project — same model as clip-factory).

Dedupe rule: scrape job upserts on `(project_id, yt_video_id)`. Re-scraping a channel costs nothing; only new videos enter the queue.

## Stitching spec (matches clip-factory's "plays clean" guarantee)

For every clip:

1. Keep only the **first 5 seconds** of the source short (the hook), discard the rest. CTA carries the message after.
2. Re-encode the kept source AND the CTA to **identical specs** before concat:
   - 1080×1920, H.264 high profile, level 4.0
   - 30fps CFR
   - AAC stereo 44.1kHz 128kbps
   - yuv420p, faststart
3. Concat via ffmpeg `concat` demuxer (not filter — stream-copy after re-encode so seams are sample-accurate).

The "re-encode both before concat" step is the whole point. Skip it and you get audio drift, glitchy seams on iOS Safari, and aspect-ratio surprises when one segment was 1920×1080 letterboxed.

Reference command sketches live in `lib/stitch/ffmpeg.ts`. Don't change the encoder settings without testing on iOS Safari.

## Auth — shared with onda-dev

- Same Firebase project (`ondadev-metrics`).
- Same allowlist collection (`allowlist/{email}` in that Firestore).
- Session cookie name and domain match `onda-dev` so signing in once covers both.
- No `role` field. Allowlist = access. Everyone in it sees everything.

The `scripts/allowlist.ts` here is identical to the one in `onda-dev` — either repo can manage the list.

## Postiz integration

- Public API (self-hosted, on `http://postiz:3000/api/public/v1` inside the docker-compose network).
- We POST a stitched mp4 + caption + platform list + scheduled time. Postiz returns a post id we store in `schedules.postiz_post_id`.
- Connected accounts are managed in Postiz's own UI — we just list them in our scheduler and let the user pick which ones to target per batch.
- Stagger interval: when bulk-scheduling N clips, we space them by `staggerMinutes` so they don't all land at the same minute.

If Postiz is down, schedule jobs go to `failed` with the error. The worker retries with exponential backoff via BullMQ.

## File layout

```
app/
  sign-in/page.tsx
  (app)/
    layout.tsx                    — top nav: Projects, Schedule, account menu
    projects/
      page.tsx                    — list + "new project"
      [id]/page.tsx               — channel input, CTA upload, clip library, scrape button
    schedule/
      page.tsx                    — bulk scheduler across projects
  api/
    auth/session/route.ts
    auth/signout/route.ts
    projects/route.ts             — POST create, GET list
    projects/[id]/route.ts        — GET, PATCH, DELETE
    projects/[id]/cta/route.ts    — POST upload CTA video
    projects/[id]/scrape/route.ts — POST trigger scrape
    clips/route.ts                — GET list (filter by project)
    clips/[id]/route.ts           — DELETE
    schedule/route.ts             — POST bulk-schedule
    postiz/accounts/route.ts      — GET connected accounts (proxied from Postiz)

middleware.ts

lib/
  db/
    index.ts                      — drizzle client
    schema.ts                     — projects, clips, schedules
  auth/
    constants.ts
    session.ts                    — cookie helpers (mirrors onda-dev)
    allowlist.ts                  — checkAllowlist(email)
  firebase-admin.ts               — getMetricsAuth + getMetricsFirestore
  firebase-client.ts              — browser SDK init
  queue/
    index.ts                      — BullMQ queues + Redis client
    jobs.ts                       — job type definitions
  scraper/
    youtube.ts                    — yt-dlp channel listing (auth-free)
    apify.ts                      — Apify run + mp4 download
  stitch/
    ffmpeg.ts                     — trim + re-encode + concat
  postiz/
    client.ts                     — REST wrapper
  storage/
    paths.ts                      — STORAGE_ROOT path helpers
  utils.ts                        — cn helper

worker/
  index.ts                        — BullMQ worker entrypoint
  handlers/
    scrape.ts                     — yt-dlp listing only
    stitch.ts                     — Apify download + ffmpeg pipeline
    schedule.ts                   — push to Postiz

scripts/
  allowlist.ts                    — manage allowlist (mirrors onda-dev)

drizzle/                          — generated migrations

infra/
  Dockerfile.web
  Dockerfile.worker
  docker-compose.yml              — slot into the existing CPX42 compose

components/
  ui/                             — shadcn primitives (Button, Card, Input, etc.)
  nav.tsx
  ...
```

## Design conventions (mirror onda-dev)

- Sentence case everywhere.
- Two font weights: 400, 500.
- No gradients, no shadows.
- 0.5px borders, `rounded-lg` cards, `rounded-md` tiles.
- No emojis in UI. Lucide icons only.
- Show negatives in red, no sugarcoating.

## What NOT to do

- Don't add NextAuth, Auth.js, Clerk. Firebase Auth only.
- Don't add Prisma. Drizzle is set up.
- Don't reach for AWS S3 / R2 in Phase 1 — local volume on CPX42 is fine, and avoids egress costs since Postiz reads from the same machine. Re-evaluate if storage exceeds ~200GB.
- Don't shell out to yt-dlp / ffmpeg from the web tier. Worker only.
- Don't bypass Postiz to call TikTok / IG / YT directly. The whole point is that Postiz owns OAuth.
- Don't run the stitch pipeline without re-encoding both segments. The seams will glitch on iOS.
- Don't auto-push commits. Commit, but push only when Gianmarco asks.
- Don't widen scope to scraping non-YouTube sources without confirmation.

## Phase plan

Phase 1 (now):
- Repo scaffold, DB schema, auth wired to ondadev-metrics, projects CRUD, CTA upload, channel-handle scrape trigger, library view, bulk scheduler UI.
- Worker handlers: yt-dlp listing + download, ffmpeg stitch, Postiz publish.
- docker-compose snippet that slots into the existing CPX42 compose alongside Postiz.

Phase 2:
- Per-clip preview before scheduling (ffmpeg generates a 5s WebM preview).
- Scrape filters (min views, max age, exclude shorts already scheduled).
- Per-project caption templates with variables (`{title}`, `{channel}`).

Phase 3:
- Multi-CTA A/B testing per project.
- Analytics: pull Postiz post analytics back into clips table for "which clip performed best".
