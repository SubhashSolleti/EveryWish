import { describe, expect, it } from "vitest";
import { planUpcoming, planYear, type WishSchedule } from "./plan";
import { PLACES } from "./places";

const sisterBirthday: WishSchedule = {
  month: 10,
  day: 6,
  hour: 0,
  minute: 0,
  placeIds: ["india", "new-york", "california"],
  recurrence: { kind: "yearly" },
};

const iso = (d: Date) => d.toISOString();
const placeIds = (d: { places: { place: { id: string } }[] }) => d.places.map((p) => p.place.id);

describe("planYear", () => {
  it("creates one delivery per place at local midnight, sorted by time", () => {
    const plan = planYear(sisterBirthday, 2026);

    expect(plan.map((d) => iso(d.dueAt))).toEqual([
      "2026-10-05T18:30:00.000Z", // India, IST +05:30
      "2026-10-06T04:00:00.000Z", // New York, EDT -04:00
      "2026-10-06T07:00:00.000Z", // California, PDT -07:00
    ]);
    expect(plan.map(placeIds)).toEqual([["india"], ["new-york"], ["california"]]);
    for (const d of plan) {
      expect(d.places[0]).toMatchObject({ localDate: "2026-10-06", localTime: "00:00" });
      expect(d.places[0].adjusted).toBeUndefined();
    }
  });

  it("collapses places that reach the moment at the same instant", () => {
    const plan = planYear({ ...sisterBirthday, placeIds: ["new-york", "toronto", "india", "sri-lanka", "nepal"] }, 2026);

    // Nepal is +05:45, so its midnight comes 15 minutes before India's
    expect(plan.map(placeIds)).toEqual([["nepal"], ["india", "sri-lanka"], ["new-york", "toronto"]]);
  });

  it("decides collapsing per date: Arizona joins California in summer, not winter", () => {
    const zones = { ...sisterBirthday, placeIds: ["california", "arizona"] };

    const summer = planYear({ ...zones, month: 7, day: 1 }, 2026);
    expect(summer).toHaveLength(1);
    expect(placeIds(summer[0])).toEqual(["california", "arizona"]);

    const winter = planYear({ ...zones, month: 1, day: 15 }, 2026);
    expect(winter.map(placeIds)).toEqual([["arizona"], ["california"]]);
  });

  it("'select all' yields fewer deliveries than places, each at a distinct instant", () => {
    const plan = planYear({ ...sisterBirthday, placeIds: PLACES.map((p) => p.id) }, 2026);
    const total = plan.reduce((n, d) => n + d.places.length, 0);
    const instants = new Set(plan.map((d) => d.dueAt.getTime()));

    expect(total).toBe(PLACES.length);
    expect(plan.length).toBeLessThan(PLACES.length);
    expect(instants.size).toBe(plan.length);
  });

  it("ignores duplicate place selections", () => {
    const plan = planYear({ ...sisterBirthday, placeIds: ["india", "india"] }, 2026);
    expect(plan).toHaveLength(1);
    expect(plan[0].places).toHaveLength(1);
  });

  it("moves Feb 29 to Feb 28 in non-leap years", () => {
    const leapling = { ...sisterBirthday, month: 2, day: 29, placeIds: ["india"] };

    expect(planYear(leapling, 2028)[0].places[0]).toMatchObject({ localDate: "2028-02-29" });
    expect(planYear(leapling, 2027)[0].places[0]).toMatchObject({ localDate: "2027-02-28", adjusted: "leap-day" });
  });

  it("moves a time skipped by spring-forward to the next valid time", () => {
    // New York jumps 02:00 → 03:00 on 2027-03-14
    const plan = planYear({ ...sisterBirthday, month: 3, day: 14, hour: 2, minute: 30, placeIds: ["new-york"] }, 2027);

    expect(plan[0].places[0]).toMatchObject({ localTime: "03:30", adjusted: "dst-gap" });
    expect(iso(plan[0].dueAt)).toBe("2027-03-14T07:30:00.000Z");
  });

  it("uses the first occurrence of a time repeated by fall-back", () => {
    // New York repeats 01:00-02:00 on 2026-11-01; first pass is EDT (-04:00)
    const plan = planYear({ ...sisterBirthday, month: 11, day: 1, hour: 1, minute: 30, placeIds: ["new-york"] }, 2026);

    expect(iso(plan[0].dueAt)).toBe("2026-11-01T05:30:00.000Z");
    expect(plan[0].places[0].adjusted).toBeUndefined();
  });

  it("rejects an empty selection and unknown places", () => {
    expect(() => planYear({ ...sisterBirthday, placeIds: [] }, 2026)).toThrow(/at least one/);
    expect(() => planYear({ ...sisterBirthday, placeIds: ["atlantis"] }, 2026)).toThrow(/Unknown place/);
  });
});

describe("planUpcoming", () => {
  it("drops deliveries that already happened this year (never late)", () => {
    // India's midnight (18:30Z) has passed; New York and California haven't
    const upcoming = planUpcoming(sisterBirthday, new Date("2026-10-05T20:00:00Z"));
    expect(upcoming.map(placeIds)).toEqual([["new-york"], ["california"]]);
    expect(upcoming.every((d) => d.occurrenceYear === 2026)).toBe(true);
  });

  it("rolls a yearly wish to next year once this year's deliveries are done", () => {
    const upcoming = planUpcoming(sisterBirthday, new Date("2026-10-06T07:00:00Z"));
    expect(upcoming).toHaveLength(3);
    expect(upcoming.every((d) => d.occurrenceYear === 2027)).toBe(true);
  });

  it("keeps an occurrence in progress across the date line and the UTC new year", () => {
    const newYear: WishSchedule = { ...sisterBirthday, month: 1, day: 1, placeIds: ["auckland", "hawaii"] };

    // Auckland's 2027 midnight (2026-12-31T11:00Z) has passed, Hawaii's hasn't
    const before = planUpcoming(newYear, new Date("2026-12-31T12:00:00Z"));
    expect(before.map(placeIds)).toEqual([["hawaii"]]);
    expect(before[0].occurrenceYear).toBe(2027);

    // Same occurrence, now viewed from inside UTC year 2027
    const after = planUpcoming(newYear, new Date("2027-01-01T05:00:00Z"));
    expect(after.map(placeIds)).toEqual([["hawaii"]]);
    expect(iso(after[0].dueAt)).toBe("2027-01-01T10:00:00.000Z");
  });

  it("returns nothing for a one-time wish that is fully in the past", () => {
    const once: WishSchedule = { ...sisterBirthday, recurrence: { kind: "once", year: 2025 } };
    expect(planUpcoming(once, new Date("2026-01-01T00:00:00Z"))).toEqual([]);
  });
});
