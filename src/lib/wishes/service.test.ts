import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { deliveries, wishes } from "@/lib/db/schema";
import { sisterBirthday, testDb } from "@/test/db";
import { cancelWish, createContact, createWish, deleteContact, rollForward, updateWish } from "./service";

let t: Awaited<ReturnType<typeof testDb>>;
beforeEach(async () => {
  t = await testDb();
});

const NOW = new Date("2026-09-01T00:00:00Z");
const rows = (wishId: string) =>
  t.db.select().from(deliveries).where(eq(deliveries.wishId, wishId)).orderBy(asc(deliveries.dueAt));

describe("createWish", () => {
  it("schedules one delivery per distinct instant", async () => {
    const wish = await createWish(
      t.db,
      t.userId,
      { ...sisterBirthday(t.endpointId), placeIds: ["india", "sri-lanka", "new-york", "toronto", "california"] },
      NOW,
    );
    const planned = await rows(wish.id);

    expect(planned.map((d) => d.places.map((p) => p.placeId))).toEqual([
      ["india", "sri-lanka"],
      ["new-york", "toronto"],
      ["california"],
    ]);
    expect(planned.every((d) => d.status === "scheduled" && d.occurrenceYear === 2026)).toBe(true);
  });

  it("rejects a one-time wish whose moment has passed everywhere", async () => {
    await expect(
      createWish(t.db, t.userId, { ...sisterBirthday(t.endpointId), recurrence: "once", year: 2025 }, NOW),
    ).rejects.toThrow(/already passed/);
    expect(await t.db.select().from(wishes)).toHaveLength(0);
  });

  it("rejects invalid input with a friendly message", async () => {
    await expect(createWish(t.db, t.userId, { ...sisterBirthday(t.endpointId), placeIds: [] }, NOW)).rejects.toThrow(
      "Choose at least one place",
    );
    await expect(
      createWish(t.db, t.userId, { ...sisterBirthday(t.endpointId), month: 2, day: 30 }, NOW),
    ).rejects.toThrow("That date doesn't exist");
  });

  it("refuses another user's recipient", async () => {
    const other = await createContact(t.db, t.userId, { name: "X", phone: "+44 7700 900123" });
    await expect(
      createWish(t.db, "00000000-0000-4000-8000-000000000000", sisterBirthday(other.endpoint.id), NOW),
    ).rejects.toThrow(/who receives/);
  });
});

describe("updateWish", () => {
  it("replans pending deliveries and keeps sent history", async () => {
    const wish = await createWish(t.db, t.userId, sisterBirthday(t.endpointId), NOW);
    const [india] = await rows(wish.id);
    await t.db.update(deliveries).set({ status: "sent" }).where(eq(deliveries.id, india.id));

    // After India's moment, switch to Tokyo + London
    const later = new Date("2026-10-05T19:00:00Z");
    await updateWish(t.db, t.userId, wish.id, { ...sisterBirthday(t.endpointId), placeIds: ["tokyo", "london"] }, later);
    const after = await rows(wish.id);

    // Tokyo's 2026 midnight (Oct 5 15:00Z) is already past, so only London remains this year
    expect(after.map((d) => [d.status, d.places.map((p) => p.placeId)])).toEqual([
      ["sent", ["india"]],
      ["scheduled", ["london"]],
    ]);
  });

  it("revives a cancelled wish", async () => {
    const wish = await createWish(t.db, t.userId, sisterBirthday(t.endpointId), NOW);
    await cancelWish(t.db, t.userId, wish.id, NOW);
    expect((await rows(wish.id)).every((d) => d.status === "cancelled")).toBe(true);

    const revived = await updateWish(t.db, t.userId, wish.id, sisterBirthday(t.endpointId), NOW);
    expect(revived.status).toBe("active");
    expect((await rows(wish.id)).map((d) => d.status)).toEqual(["scheduled", "scheduled", "scheduled"]);
  });
});

describe("rollForward", () => {
  it("prepares next year once a yearly occurrence is done", async () => {
    const wish = await createWish(t.db, t.userId, sisterBirthday(t.endpointId), NOW);
    await t.db.update(deliveries).set({ status: "sent" }).where(eq(deliveries.wishId, wish.id));

    const result = await rollForward(t.db, new Date("2026-10-06T07:01:00Z"));
    const next = (await rows(wish.id)).filter((d) => d.status === "scheduled");

    expect(result).toEqual({ replanned: 1, completed: 0 });
    expect(next).toHaveLength(3);
    expect(next.every((d) => d.occurrenceYear === 2027)).toBe(true);
  });

  it("leaves a wish alone while any delivery is pending", async () => {
    await createWish(t.db, t.userId, sisterBirthday(t.endpointId), NOW);
    expect(await rollForward(t.db, NOW)).toEqual({ replanned: 0, completed: 0 });
  });

  it("completes a one-time wish once it's done", async () => {
    const wish = await createWish(t.db, t.userId, { ...sisterBirthday(t.endpointId), recurrence: "once", year: 2026 }, NOW);
    await t.db.update(deliveries).set({ status: "sent" }).where(eq(deliveries.wishId, wish.id));

    expect(await rollForward(t.db, new Date("2026-10-07T00:00:00Z"))).toEqual({ replanned: 0, completed: 1 });
    const [w] = await t.db.select().from(wishes).where(eq(wishes.id, wish.id));
    expect(w.status).toBe("completed");
  });
});

describe("contacts", () => {
  it("requires a country code", async () => {
    await expect(createContact(t.db, t.userId, { name: "Mom", phone: "98765 43210" })).rejects.toThrow(/country code/);
  });

  it("won't delete a contact with active wishes", async () => {
    const { contact, endpoint } = await createContact(t.db, t.userId, { name: "Mom", phone: "+91 98765 43210" });
    const wish = await createWish(t.db, t.userId, sisterBirthday(endpoint.id), NOW);

    await expect(deleteContact(t.db, t.userId, contact.id)).rejects.toThrow(/active wishes/);
    await cancelWish(t.db, t.userId, wish.id, NOW);
    await deleteContact(t.db, t.userId, contact.id);
    expect(await t.db.select().from(wishes).where(eq(wishes.id, wish.id))).toHaveLength(0);
  });
});
