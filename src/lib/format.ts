import { DateTime } from "luxon";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const monthName = (month: number) => MONTHS[month - 1];

/** "October 6" */
export const monthDay = (month: number, day: number) => `${monthName(month)} ${day}`;

/** "00:00" → "12:00 AM" */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const hourMinute = (hour: number, minute: number) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

/** "Oct 5, 6:30 PM" in the given zone (defaults to the viewer's). */
export function instantIn(date: Date, zone?: string): string {
  const dt = DateTime.fromJSDate(date, zone ? { zone } : {});
  return dt.toFormat("LLL d, h:mm a");
}

/** "in 5 hours", "in 3 days", "2 days ago" */
export function relative(date: Date, now: Date = new Date()): string {
  return DateTime.fromJSDate(date).toRelative({ base: DateTime.fromJSDate(now) }) ?? "";
}
