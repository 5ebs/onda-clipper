/**
 * Thin wrapper around the Postiz public API. We only use the bits we
 * need: list connected accounts, upload media, create a scheduled post.
 *
 * Postiz's public API is mounted at POSTIZ_API_URL (e.g.
 * `https://posts.ondadev.com/api/public/v1`). API key is sent as
 * `Authorization: <key>` (no Bearer prefix).
 */

const API_URL = process.env.POSTIZ_API_URL;
const API_KEY = process.env.POSTIZ_API_KEY;

function requireConfig() {
  if (!API_URL) throw new Error("POSTIZ_API_URL is not set");
  if (!API_KEY) throw new Error("POSTIZ_API_KEY is not set");
  return { url: API_URL, key: API_KEY };
}

export type PostizAccount = {
  id: string;
  name: string;
  identifier: string; // tiktok | instagram | youtube | ...
  picture?: string | null;
};

export async function listAccounts(): Promise<PostizAccount[]> {
  const { url, key } = requireConfig();
  const res = await fetch(`${url}/integrations`, {
    headers: { Authorization: key },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`postiz integrations failed: ${res.status}`);
  }
  const data = (await res.json()) as
    | PostizAccount[]
    | { integrations: PostizAccount[] };
  return Array.isArray(data) ? data : (data.integrations ?? []);
}

/** Upload media to Postiz; returns an id + path we attach to a post. */
export async function uploadMedia(file: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}): Promise<{ id: string; path: string }> {
  const { url, key } = requireConfig();
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(file.buffer)], { type: file.contentType }),
    file.filename,
  );
  const res = await fetch(`${url}/upload`, {
    method: "POST",
    headers: { Authorization: key },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`postiz upload failed: ${res.status}`);
  }
  return (await res.json()) as { id: string; path: string };
}

export type PostEntry = {
  accountId: string;
  /** identifier string from Postiz: "tiktok" | "instagram" | "youtube" | ... */
  platform: string;
  caption: string;
  mediaId: string; // id returned by uploadMedia
  mediaPath: string; // path returned by uploadMedia
};

export type CreatePostInput = {
  scheduledAt: Date;
  /** One entry per Postiz account we want to fan out to. */
  posts: PostEntry[];
};

/**
 * Build the per-platform `settings` object the Postiz validator wants.
 * Sensible "publish publicly with sane defaults" values; if the user
 * needs different per-platform behaviour we extend this later.
 */
function platformSettings(platform: string, caption: string): Record<string, unknown> {
  const titleFromCaption = (caption || "Untitled")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  switch (platform) {
    case "tiktok":
      return {
        __type: "tiktok",
        title: titleFromCaption,
        // Until the TikTok app passes the "Content Sharing" audit it is
        // tagged "unaudited" and can only post privately. Flip back to
        // PUBLIC_TO_EVERYONE via env var once the audit lands.
        privacy_level:
          process.env.TIKTOK_PRIVACY_LEVEL ?? "SELF_ONLY",
        duet: true,
        stitch: true,
        comment: true,
        autoAddMusic: "no",
        brand_content_toggle: false,
        brand_organic_toggle: false,
        content_posting_method: "DIRECT_POST",
      };
    case "instagram":
    case "instagram-standalone":
      return {
        __type: platform,
        post_type: "post",
        collaborators: [],
      };
    case "youtube":
      return {
        __type: "youtube",
        title: titleFromCaption.slice(0, 100) || "Untitled",
        type: "public",
        tags: [],
      };
    default:
      // For unknown platforms send an empty settings with the discriminator;
      // Postiz may still accept it for "EmptySettings" providers.
      return { __type: platform };
  }
}

/**
 * Create a scheduled post on Postiz. One Post entry per integration —
 * Postiz publishes each independently.
 */
export async function createPost(
  input: CreatePostInput,
): Promise<{ id: string }> {
  const { url, key } = requireConfig();
  const body = {
    type: "schedule",
    shortLink: false,
    date: input.scheduledAt.toISOString(),
    tags: [],
    posts: input.posts.map((p) => ({
      integration: { id: p.accountId },
      value: [
        {
          content: p.caption || " ",
          image: [{ id: p.mediaId, path: p.mediaPath }],
        },
      ],
      settings: platformSettings(p.platform, p.caption),
    })),
  };
  const res = await fetch(`${url}/posts`, {
    method: "POST",
    headers: {
      Authorization: key,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(
      `postiz create post failed: ${res.status} ${t.slice(0, 600)}`,
    );
  }
  const data = (await res.json()) as { id: string };
  return data;
}
