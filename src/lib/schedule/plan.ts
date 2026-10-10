import { DateTime } from "luxon";
import { getPlace, type Place } from "./places";

/**
 * What the user chose: a local date + local time, and the places where that
 * moment should be celebrated. Never contains UTC — that is derived here.
 */
export type WishSchedule = {
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23, local to each place
  minute: number; // 0-59
  placeIds: string[];
  /** "once" needs `year`; "yearly" repeats every year. */
  recurrence: { kind: "once"; year: number } | { kind: "yearly" };
};

export type PlannedPlace = {
  place: Place;
  /** Local date/time the message lands at, e.g. "2026-10-06" / "00:00". */
  localDate: string;
  localTime: string;
  /**
   * Set when the requested moment couldn't be used as-is:
   * - "leap-day": Feb 29 in a non-leap year → Feb 28
   * - "dst-gap": clocks skip the requested time → next valid time
   */
  adjusted?: "leap-day" | "dst-gap";
};

/** One message send. Places reaching the same instant share one delivery. */
export type PlannedDelivery = {
  dueAt: Date;
  occurrenceYear: number;
  places: PlannedPlace[];
};

/** Plan every delivery for one year's occurrence of a wish, sorted by time. */
export function planYear(schedule: WishSchedule, year: number): PlannedDelivery[] {
  const placeIds = [...new Set(schedule.placeIds)];
  if (placeIds.length === 0) throw new Error("Select at least one place");

  const groups = new Map<number, PlannedPlace[]>();
  for (const id of placeIds) {
    const place = getPlace(id);
    const { instant, planned } = localMoment(schedule, year, place);
    const key = instant.toMillis();
    const group = groups.get(key);
    if (group) group.push(planned);
    else groups.set(key, [planned]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ms, places]) => ({ dueAt: new Date(ms), occurrenceYear: year, places }));
}

/**
 * Deliveries still to come for the next occurrence of a wish.
 * Deliveries whose moment has already passed are dropped — we never send late.
 * Returns [] when a one-time wish is entirely in the past.
 */
export function planUpcoming(schedule: WishSchedule, now: Date): PlannedDelivery[] {
  const isFuture = (d: PlannedDelivery) => d.dueAt.getTime() > now.getTime();

  if (schedule.recurrence.kind === "once") {
    return planYear(schedule, schedule.recurrence.year).filter(isFuture);
  }

  // A local date spans ~50h of UTC across the globe (UTC+14 … UTC-12), so the
  // occurrence still in progress may belong to the previous calendar year.
  const utcYear = now.getUTCFullYear();
  for (let year = utcYear - 1; year <= utcYear + 1; year++) {
    const upcoming = planYear(schedule, year).filter(isFuture);
    if (upcoming.length > 0) return upcoming;
  }
  return [];
}

function localMoment(schedule: WishSchedule, year: number, place: Place) {
  let { day } = schedule;
  let adjusted: PlannedPlace["adjusted"];

  if (schedule.month === 2 && day === 29 && !DateTime.local(year).isInLeapYear) {
    day = 28;
    adjusted = "leap-day";
  }

  const instant = DateTime.fromObject(
    { year, month: schedule.month, day, hour: schedule.hour, minute: schedule.minute },
    { zone: place.zone },
  );
  if (!instant.isValid) {
    throw new Error(`Invalid date ${year}-${schedule.month}-${day}: ${instant.invalidExplanation}`);
  }

  // Luxon moves a non-existent wall time (spring-forward gap) to a later valid
  // time; ambiguous times (fall-back) resolve to the first occurrence.
  if (instant.hour !== schedule.hour || instant.minute !== schedule.minute) {
    adjusted = "dst-gap";
  }

  return {
    instant,
    planned: {
      place,
      localDate: instant.toISODate()!,
      localTime: instant.toFormat("HH:mm"),
      ...(adjusted && { adjusted }),
    },
  };
}
