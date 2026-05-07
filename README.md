# onda-clipper

Pull viral YouTube Shorts from a creator handle, stitch our app's CTA on the end, bulk-schedule to TikTok / Instagram Reels / YouTube Shorts via self-hosted Postiz.

Read [CLAUDE.md](./CLAUDE.md) for the full architecture, conventions, and what-not-to-do.

## Local dev

```sh
# 1. install
npm install

# 2. env
cp .env.example .env
# fill in Firebase + DATABASE_URL + REDIS_URL + POSTIZ_*

# 3. infra (Postgres + Redis only, locally via Docker)
docker compose -f infra/docker-compose.dev.yml up -d

# 4. db
npm run db:push

# 5. allowlist yourself
npm run allowlist add --email you@example.com

# 6. run
npm run dev          # web on :3000
npm run worker       # worker, in a separate terminal

# 7. system deps for the worker
#    macOS:  brew install yt-dlp ffmpeg
#    Linux:  apt install ffmpeg && pip install yt-dlp
#    Windows: choco install yt-dlp ffmpeg
```

## Deploy (Hetzner CPX42 — same box as Postiz)

The `infra/docker-compose.yml` here is meant to be merged into the existing compose stack on the CPX42 (alongside `postiz`, `postgres`, `redis-postiz`). It adds `clipper-web`, `clipper-worker`, `clipper-postgres`, `clipper-redis`.

Storage volume `./storage` is shared between web (read for previews) and worker (read/write for downloads + stitches).

## Stack

Next 15 · TS strict · Tailwind + shadcn · Drizzle/Postgres · BullMQ/Redis · Firebase Auth (shared with `onda-dev`) · yt-dlp + ffmpeg in the worker · Postiz REST API for publishing.
