import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getMetricsAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./constants";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };

export async function mintSessionCookie(idToken: string): Promise<string> {
  return getMetricsAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export async function verifySession(): Promise<DecodedIdToken | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    return await getMetricsAuth().verifySessionCookie(cookie, true);
  } catch {
    return null;
  }
}

export async function requireSession(
  redirectTo: string = "/sign-in",
): Promise<DecodedIdToken> {
  const session = await verifySession();
  if (!session) redirect(redirectTo);
  return session;
}

export function sessionCookieOptions() {
  // Same scope as onda-dev: in prod we set APP_HOST=".ondadev.com" so a
  // session minted on either app is accepted on the other (single sign-on
  // across the dashboard and the clipper).
  const host = process.env.APP_HOST;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    ...(host ? { domain: host } : {}),
  };
}
