"use client";

import { useMemo } from "react";
import { clockTime, instantIn, monthDay } from "@/lib/format";
import { planUpcoming, planYear, type WishSchedule } from "@/lib/schedule/plan";
import { getPlace } from "@/lib/schedule/places";
import { useIsClient } from "./use-is-client";

type Row = {
  key: number;
  placeIds: string[];
  localTime: string;
  localDate: string;
  dueAt: Date;
  passed: boolean;
  adjusted: boolean;
};

/** Plan the next occurrence, including places whose moment already passed (shown greyed). */
function buildPreview(schedule: WishSchedule, now: Date) {
  try {
    return previewOf(schedule, now);
  } catch {
    return null; // e.g. a date that doesn't exist; the form shows the validation message
  }
}

function previewOf(schedule: WishSchedule, now: Date) {
  const upcoming = planUpcoming(schedule, now);
  const year =
    upcoming[0]?.occurrenceYear ??
    (schedule.recurrence.kind === "once" ? schedule.recurrence.year : now.getUTCFullYear());
  const rows: Row[] = planYear(schedule, year).map((d) => ({
    key: d.dueAt.getTime(),
    placeIds: d.places.map((p) => p.place.id),
    localTime: d.places[0].localTime,
    localDate: d.places[0].localDate,
    dueAt: d.dueAt,
    passed: d.dueAt.getTime() <= now.getTime(),
    adjusted: d.places.some((p) => p.adjusted),
  }));
  return { year, rows, count: upcoming.length };
}

export function Preview({
  schedule,
  title,
  emoji,
  message,
}: {
  schedule: WishSchedule | null;
  title: string;
  emoji: string;
  message: string;
}) {
  const isClient = useIsClient();
  const preview = useMemo(
    () => (isClient && schedule && schedule.placeIds.length > 0 ? buildPreview(schedule, new Date()) : null),
    [isClient, schedule],
  );
  const placeCount = schedule?.placeIds.length ?? 0;
  const once = schedule?.recurrence.kind === "once";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-xl">{emoji}</span>
        <div>
          <p className="font-display text-lg font-semibold leading-tight">{title}</p>
          {schedule && (
            <p className="text-sm text-muted">
              {monthDay(schedule.month, schedule.day)}
              {preview ? `, ${preview.year}` : ""} · {once ? "one time" : "every year"}
            </p>
          )}
        </div>
      </div>

      {message.trim() && (
        <p className="w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-bubble px-3.5 py-2 text-[15px] text-bubble-ink">
          {message}
        </p>
      )}

      <div className="rounded-2xl bg-surface-2 p-4">
        <p className="text-sm font-semibold">
          {placeCount} {placeCount === 1 ? "place" : "places"} selected
        </p>
        <p className="font-display text-2xl font-semibold text-accent">
          {preview?.count ?? 0} {preview?.count === 1 ? "delivery" : "deliveries"} scheduled
        </p>
        {preview && preview.rows.length < placeCount && (
          <p className="mt-1 text-xs text-muted">
            Places that reach the moment at the same instant share one message, so nobody gets duplicates.
          </p>
        )}
      </div>

      {!preview && placeCount === 0 && (
        <p className="text-sm text-muted">Pick at least one place to see when your wish will arrive.</p>
      )}

      {preview && (
        <ul className="flex flex-col gap-2">
          {preview.rows.map((row) => (
            <li
              key={row.key}
              className={`rounded-xl border border-line bg-surface px-3 py-2.5 ${row.passed ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="flex flex-wrap gap-x-2 gap-y-0.5 font-medium">
                  {row.placeIds.map((id) => (
                    <span key={id} className="whitespace-nowrap">
                      {getPlace(id).flag} {getPlace(id).label}
                    </span>
                  ))}
                </span>
                <span className="whitespace-nowrap font-semibold">{clockTime(row.localTime)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {row.passed
                  ? once
                    ? "Already passed there — won't be sent"
                    : `Already passed there this year — included from ${preview.year + 1}`
                  : `${monthDay(Number(row.localDate.slice(5, 7)), Number(row.localDate.slice(8, 10)))} local time · your time: ${instantIn(row.dueAt)}`}
                {row.adjusted && " · adjusted (date or clock change)"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {schedule && placeCount > 0 && (
        <p className="text-xs text-muted">
          {clockTime(`${schedule.hour}:${schedule.minute}`)} means {clockTime(`${schedule.hour}:${schedule.minute}`)}{" "}
          on the clock in <em>each</em> place, not where you are. Daylight saving and date lines are handled for you.
        </p>
      )}
    </div>
  );
}
