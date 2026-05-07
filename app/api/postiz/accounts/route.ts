import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listAccounts } from "@/lib/postiz/client";

export async function GET() {
  await requireSession();
  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "postiz_error" },
      { status: 502 },
    );
  }
}
