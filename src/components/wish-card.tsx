import { clockTime, hourMinute, monthDay } from "@/lib/format";
import { OCCASION_META, wishTitle } from "@/lib/occasions";
import type { WishView } from "@/lib/wishes/queries";
import { DeliveryStatus } from "./delivery-status";
import { PlaceGroup } from "./place-group";
import { WishActions } from "./wish-actions";

export function WishCard({ wish, now }: { wish: WishView; now: Date }) {
  const meta = OCCASION_META[wish.occasion];
  const time = clockTime(hourMinute(wish.hour, wish.minute));
  const deliveries = wish.current;
  const placeCount = wish.placeIds.length;
  const year = deliveries[0]?.occurrenceYear;

  return (
    <article className="card flex flex-col gap-4 p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl" aria-hidden>
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold leading-tight">
            {wishTitle(wish.contactName, wish.occasion, wish.occasionLabel)}
          </h2>
          <p className="text-sm text-muted">
            {monthDay(wish.month, wish.day)}
            {wish.recurrence === "once" ? `, ${wish.year}` : year ? ` · ${year}` : ""} · {time} in each place
          </p>
        </div>
        {wish.recurrence === "yearly" && wish.status === "active" && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
            Every year
          </span>
        )}
        {wish.status !== "active" && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium capitalize text-muted">
            {wish.status}
          </span>
        )}
      </header>

      <p className="w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-bubble px-3.5 py-2 text-[15px] text-bubble-ink">
        {wish.message}
      </p>

      <div>
        <p className="mb-2 text-sm font-medium">
          {placeCount} {placeCount === 1 ? "place" : "places"} · {deliveries.length}{" "}
          {deliveries.length === 1 ? "delivery" : "deliveries"}
          <span className="font-normal text-muted"> to {wish.address}</span>
        </p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {deliveries.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <PlaceGroup placeIds={d.places.map((p) => p.placeId)} />
                <span className="text-xs text-muted">
                  {clockTime(d.places[0].localTime)} local time
                  {d.places.some((p) => p.adjusted) && " (adjusted for this year's calendar)"}
                </span>
              </div>
              <DeliveryStatus delivery={d} now={now} />
            </li>
          ))}
          {deliveries.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No deliveries scheduled.</li>}
        </ul>
      </div>

      <footer className="-mx-2 -mb-2">
        <WishActions wishId={wish.id} active={wish.status === "active"} />
      </footer>
    </article>
  );
}
