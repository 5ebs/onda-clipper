import { spawn } from "node:child_process";

export type YtShortMeta = {
  id: string;
  title: string;
  viewCount: number | null;
  thumbnail: string | null;
  duration: number | null;
  publishedAt: string | null; // ISO
  url: string;
};

/**
 * List recent shorts on a channel via yt-dlp's --flat-playlist mode.
 * `handle` accepts `@handle`, channel id (UCxxx), or full URL.
 *
 * Listing the /shorts tab does not require auth and does not trigger
 * YouTube's bot challenge, so we keep yt-dlp here. Downloads go through
 * Apify (lib/scraper/apify.ts).
 */
export async function listChannelShorts(
  handle: string,
  limit: number,
): Promise<YtShortMeta[]> {
  const channelUrl = normalizeChannelUrl(handle);
  const url = `${channelUrl}/shorts`;

  const args = [
    "--flat-playlist",
    "--playlist-end",
    String(limit),
    "--dump-json",
    "--no-warnings",
    url,
  ];

  const json = await runYtDlp(args);
  const lines = json.split("\n").filter(Boolean);
  const items: YtShortMeta[] = [];
  for (const line of lines) {
    try {
      const o = JSON.parse(line);
      items.push({
        id: o.id,
        title: o.title ?? "",
        viewCount: typeof o.view_count === "number" ? o.view_count : null,
        thumbnail: pickThumbnail(o),
        duration: typeof o.duration === "number" ? o.duration : null,
        publishedAt: null,
        url: `https://www.youtube.com/shorts/${o.id}`,
      });
    } catch {
      /* skip malformed line */
    }
  }
  return items;
}

function normalizeChannelUrl(handle: string) {
  const trimmed = handle.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("@")) return `https://www.youtube.com/${trimmed}`;
  if (/^UC[\w-]{20,}$/.test(trimmed)) {
    return `https://www.youtube.com/channel/${trimmed}`;
  }
  return `https://www.youtube.com/@${trimmed}`;
}

function pickThumbnail(o: { thumbnails?: { url: string }[]; thumbnail?: string }) {
  if (Array.isArray(o.thumbnails) && o.thumbnails.length > 0) {
    return o.thumbnails[o.thumbnails.length - 1]?.url ?? null;
  }
  return o.thumbnail ?? null;
}

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH ?? "yt-dlp";
    // Pass a slim env. The worker's full env (Firebase JSON keys, API
    // tokens, etc.) overflows Windows' 32KB env block limit and the
    // yt-dlp PyInstaller bundle bails out with 0xC0000142 (DLL init
    // failure) before any Python code runs.
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: minimalEnv(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

function minimalEnv(): NodeJS.ProcessEnv {
  const keep = [
    "PATH",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "ComSpec",
    "PATHEXT",
    "LANG",
    "LC_ALL",
    "PYTHONIOENCODING",
    "NODE_ENV",
  ];
  const out: Record<string, string | undefined> = {};
  for (const k of keep) out[k] = process.env[k];
  return out as NodeJS.ProcessEnv;
}
