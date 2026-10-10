import Link from "next/link";
import { Suspense } from "react";
import { AlertsBanner } from "@/components/alerts-banner";
import { WishCard } from "@/components/wish-card";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSenderHealth, listAlerts, listWishes } from "@/lib/wishes/queries";

export default function Dashboard() {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your wishes</h1>
          <p className="mt-1 text-muted">Write once · choose when · choose where in the world · forget about it.</p>
        </div>
        <Link href="/wishes/new" className="btn btn-primary">
          + New wish
        </Link>
      </div>
      <Suspense fallback={<CardsSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const userId = await requireUserId();
  const db = getDb();
  const now = new Date();
  const [active, past, alertItems, { workerOnline: workerUp, connected }] = await Promise.all([
    listWishes(db, userId, ["active"]),
    listWishes(db, userId, ["completed", "cancelled"]),
    listAlerts(db, userId),
    getSenderHealth(db, userId, now),
  ]);

  return (
    <>
      {active.length > 0 && !workerUp && (
        <Notice tone="bad">
          The sender is offline, so wishes can&apos;t go out. Start it with <code>npm run worker</code>.
        </Notice>
      )}
      {active.length > 0 && workerUp && !connected && (
        <Notice tone="bad">
          WhatsApp isn&apos;t connected, so your wishes can&apos;t be sent.{" "}
          <Link href="/whatsapp" className="font-semibold underline">
            Connect WhatsApp
          </Link>
        </Notice>
      )}
      <AlertsBanner items={alertItems} />

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {active.map((w) => (
            <WishCard key={w.id} wish={w} now={now} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">
            Completed & cancelled ({past.length})
          </summary>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {past.map((w) => (
              <WishCard key={w.id} wish={w} now={now} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function Notice({ tone, children }: { tone: "bad"; children: React.ReactNode }) {
  return (
    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${tone === "bad" ? "border-bad/30 bg-bad-soft" : ""}`}>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <p className="text-4xl">🎂</p>
      <h2 className="mt-3 font-display text-2xl font-semibold">Wish them at midnight, wherever they are</h2>
      <p className="mt-3 text-muted">
        Write one message, pick the date and time, then pick the places in the world where it should arrive. For each
        place, EveryWish sends it when the clock there reaches your chosen time.
      </p>
      <div className="mx-auto mt-6 max-w-xs space-y-1.5 rounded-2xl bg-surface-2 p-4 text-left text-sm">
        <p>🇮🇳 India — 12:00 AM</p>
        <p>🇺🇸 New York — 12:00 AM</p>
        <p>🇺🇸 California — 12:00 AM</p>
        <p className="pt-1 text-xs text-muted">Midnight in each place, not midnight where you are.</p>
      </div>
      <Link href="/wishes/new" className="btn btn-primary mt-6">
        Create your first wish
      </Link>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="card h-72 animate-pulse bg-surface-2/50" />
      ))}
    </div>
  );
}
