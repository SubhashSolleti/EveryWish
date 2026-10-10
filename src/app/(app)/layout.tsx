import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions";
import { ActiveNav, Nav } from "@/components/nav";
import { WhatsAppPill } from "@/components/whatsapp-pill";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight">
            Every<span className="text-accent">Wish</span>
          </Link>
          <Suspense fallback={<Nav pathname={null} />}>
            <ActiveNav />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={<span className="h-7 w-36 animate-pulse rounded-full bg-surface-2" />}>
              <WhatsAppPill />
            </Suspense>
            <form action={logout}>
              <button className="rounded-full px-2 py-1.5 text-xs text-muted hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
