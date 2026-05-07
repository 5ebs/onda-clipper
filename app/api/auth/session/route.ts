import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getMetricsAuth } from "@/lib/firebase-admin";
import { checkAllowlist } from "@/lib/auth/allowlist";
import {
  SESSION_COOKIE_NAME,
  mintSessionCookie,
  sessionCookieOptions,
} from "@/lib/auth/session";

const Body = z.object({ idToken: z.string().min(10) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { idToken } = parsed.data;
  const auth = getMetricsAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const email = decoded.email;
  if (!email) {
    return NextResponse.json({ error: "no_email" }, { status: 400 });
  }

  const allowed = await checkAllowlist(email);
  if (!allowed) {
    // Hostile cleanup: don't leave an unauthenticated user account behind.
    try {
      await auth.deleteUser(decoded.uid);
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { error: "not_on_allowlist", email },
      { status: 403 },
    );
  }

  const sessionCookie = await mintSessionCookie(idToken);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, sessionCookie, sessionCookieOptions());
  return NextResponse.json({ ok: true });
}
