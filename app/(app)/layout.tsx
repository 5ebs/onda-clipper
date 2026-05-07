import { requireSession } from "@/lib/auth/session";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <div className="min-h-screen flex flex-col">
      <Nav email={session.email ?? null} />
      <main className="flex-1 px-4 py-6 max-w-screen-2xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
