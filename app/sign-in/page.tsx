"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { getClientAuth, googleProvider } from "@/lib/firebase-client";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithPopup(getClientAuth(), googleProvider);
      const idToken = await result.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.status === 403) {
        setError(
          "You're not on the allowlist. Ask gianmarco@ondadev.com to add you.",
        );
        return;
      }
      if (!res.ok) {
        setError("Sign-in failed. Try again.");
        return;
      }
      router.replace("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="OndaDev"
            width={64}
            height={64}
            priority
          />
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-xl font-medium">
              OndaDev <span className="font-serif italic">Clipper</span>
            </h1>
            <p className="text-xs text-muted-foreground">Internal tool</p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-3 w-full">
          <button
            onClick={signIn}
            disabled={busy}
            className="inline-flex items-center justify-center gap-3 h-11 rounded-md bg-white px-5 text-sm font-medium text-neutral-900 shadow-sm transition-colors hover:bg-neutral-100 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Image src="/google-logo.webp" alt="" width={18} height={18} />
            {busy ? "Signing in…" : "Sign in with Google"}
          </button>
          {error ? (
            <p className="text-xs text-destructive text-center">{error}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
