"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";
import { cn } from "@/lib/utils";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/schedule", label: "Schedule" },
];

export function Nav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut(getClientAuth()).catch(() => {});
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/sign-in");
  }

  return (
    <header className="border-b border-border">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-5">
        <div className="flex items-center gap-6">
          <Link
            href="/projects"
            className="flex items-center gap-2 md:gap-2.5 shrink-0"
          >
            <Image src="/logo.png" alt="OndaDev" width={32} height={20} priority />
            <span className="hidden sm:inline text-[14px] font-medium">
              Clipper
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "text-muted-foreground hover:text-foreground transition-colors",
                  pathname?.startsWith(l.href) && "text-foreground",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {email && (
            <span className="hidden sm:inline text-muted-foreground">
              {email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
