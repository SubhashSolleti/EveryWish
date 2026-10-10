import Link from "next/link";
import { Suspense } from "react";
import { DeliveryStatus } from "@/components/delivery-status";
import { PlaceGroup } from "@/components/place-group";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { DeliveryStatus as Status } from "@/lib/db/schema";
import { clockTime, instantIn } from "@/lib/format";
import { OCCASION_META, wishTitle } from "@/lib/occasions";
import { getPlace } from "@/lib/schedule/places";
import { deliveryCounts, listDeliveries } from "@/lib/wishes/queries";

const TABS = {
  upcoming: { label: "Upcoming", statuses: ["scheduled", "sending"] },
  sent: { label: "Completed", statuses: ["sent"] },
  problems: { label: "Failed & missed", statuses: ["failed", "missed"] },
} satisfies Record<string, { label: string; statuses: Status[] }>;
type Tab = keyof typeof TABS;

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <>
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Deliveries</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <History searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function History({ searchParams }: Pick<PageProps<"/history">, "searchParams">) {
  const userId = await requireUserId();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = typeof rawTab === "string" && rawTab in TABS ? (rawTab as Tab) : "upcoming";
  const db = getDb();
  const [items, counts] = await Promise.all([
    listDeliveries(db, userId, TABS[tab].statuses),
    deliveryCounts(db, userId),
  ]);
  const now = new Date();

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(TABS) as Tab[]).map((key) => {
          const count = TABS[key].statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);
          return (
            <Link
              key={key}
              href={`/history?tab=${key}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                key === tab ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-ink"
              }`}
            >
              {TABS[key].label} <span className="text-muted">{count}</span>
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="card p-8 text-center text-muted">Nothing here yet.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((d) => {
            const zone = getPlace(d.places[0].placeId).zone;
            return (
              <li key={d.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 text-sm">
                  <Link href={`/wishes/${d.wishId}`} className="font-semibold hover:underline">
                    {OCCASION_META[d.occasion].emoji} {wishTitle(d.contactName, d.occasion, d.occasionLabel)}
                  </Link>
                  <div className="mt-1">
                    <PlaceGroup placeIds={d.places.map((p) => p.placeId)} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {d.places[0].localDate} · {clockTime(d.places[0].localTime)} local time
                    {d.sentAt && ` · sent ${instantIn(d.sentAt, zone)} there`}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted">“{d.sentMessage ?? d.wishMessage}”</p>
                </div>
                <DeliveryStatus delivery={d} now={now} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
