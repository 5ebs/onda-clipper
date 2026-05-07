import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PROTECTED_API_PREFIXES = [
  "/api/projects",
  "/api/clips",
  "/api/schedule",
  "/api/postiz",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p)) &&
    !req.cookies.get(SESSION_COOKIE_NAME)?.value
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
