import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeliveryStatus } from "@/components/delivery-status";
import { PlaceGroup } from "@/components/place-group";
import { WishActions } from "@/components/wish-actions";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clockTime, hourMinute, instantIn, monthDay } from "@/lib/format";
import { OCCASION_META, wishTitle } from "@/lib/occasions";
import { getPlace } from "@/lib/schedule/places";
import { getWish } from "@/lib/wishes/queries";

export default function WishPage({ params }: PageProps<"/wishes/[id]">) {
  return (
    <>
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← All wishes
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <WishDetail params={params} />
      </Suspense>
    </>
  );
}

async function WishDetail({ params }: Pick<PageProps<"/wishes/[id]">, "params">) {
  const userId = await requireUserId();
  const { id } = await params;
  const wish = await getWish(getDb(), userId, id);
  if (!wish) notFound();
  const now = new Date();

  const years = [...new Set(wish.deliveries.map((d) => d.occurrenceYear))];

  return (
    <div className="mt-4 flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {OCCASION_META[wish.occasion].emoji} {wishTitle(wish.contactName, wish.occasion, wish.occasionLabel)}
          </h1>
          <p className="mt-1 text-muted">
            {monthDay(wish.month, wish.day)}
            {wish.recurrence === "once" ? `, ${wish.year}` : ", every year"} ·{" "}
            {clockTime(hourMinute(wish.hour, wish.minute))} in each place · to {wish.address}
            {wish.status !== "active" && ` · ${wish.status}`}
          </p>
        </div>
        <WishActions wishId={wish.id} active={wish.status === "active"} />
      </header>

      <p className="w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-bubble px-3.5 py-2 text-[15px] text-bubble-ink">
        {wish.message}
      </p>

      {years.length === 0 && <p className="text-muted">No deliveries yet.</p>}
      {years.map((year) => (
        <section key={year} className="card overflow-hidden">
          <h2 className="border-b border-line bg-surface-2 px-4 py-2 text-sm font-semibold">{year}</h2>
          <ul className="divide-y divide-line">
            {wish.deliveries
              .filter((d) => d.occurrenceYear === year)
              .map((d) => {
                const zone = getPlace(d.places[0].placeId).zone;
                return (
                  <li key={d.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <PlaceGroup placeIds={d.places.map((p) => p.placeId)} />
                      <p className="text-xs text-muted">
                        {clockTime(d.places[0].localTime)} local time
                        {d.sentAt && ` · sent ${instantIn(d.sentAt, zone)} there`}
                        {d.attempts > 1 && ` · ${d.attempts} attempts`}
                      </p>
                      {d.sentMessage && d.sentMessage !== wish.message && (
                        <p className="mt-1 text-xs text-muted">Sent text: “{d.sentMessage}”</p>
                      )}
                    </div>
                    <DeliveryStatus delivery={d} now={now} />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
