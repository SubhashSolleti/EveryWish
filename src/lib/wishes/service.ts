import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import type { Db } from "../db";
import { contacts, deliveries, endpoints, wishes, type Wish } from "../db/schema";
import { normalizePhone } from "../phone";
import { planUpcoming, type WishSchedule } from "../schedule/plan";
import { contactInput, wishInput, type WishInput } from "./input";

/** An error whose message is safe and useful to show the user. */
export class UserError extends Error {}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
const PENDING = ["scheduled", "sending"] as const;

export function toSchedule(w: Pick<Wish, "month" | "day" | "hour" | "minute" | "placeIds" | "recurrence" | "year">): WishSchedule {
  return {
    month: w.month,
    day: w.day,
    hour: w.hour,
    minute: w.minute,
    placeIds: w.placeIds,
    recurrence: w.recurrence === "once" ? { kind: "once", year: w.year! } : { kind: "yearly" },
  };
}

/**
 * Replace a wish's not-yet-sent deliveries with a fresh plan.
 * Sent / failed / missed history is never touched.
 */
async function replan(tx: Tx | Db, wish: Wish, now: Date): Promise<number> {
  await tx
    .delete(deliveries)
    .where(and(eq(deliveries.wishId, wish.id), inArray(deliveries.status, ["scheduled", "cancelled"])));
  const planned = planUpcoming(toSchedule(wish), now);
  if (planned.length === 0) return 0;

  const inserted = await tx
    .insert(deliveries)
    .values(
      planned.map((d) => ({
        userId: wish.userId,
        wishId: wish.id,
        dueAt: d.dueAt,
        occurrenceYear: d.occurrenceYear,
        places: d.places.map((p) => ({
          placeId: p.place.id,
          localDate: p.localDate,
          localTime: p.localTime,
          ...(p.adjusted && { adjusted: p.adjusted }),
        })),
      })),
    )
    // A delivery already in flight for the same instant stays as it is.
    .onConflictDoNothing({ target: [deliveries.wishId, deliveries.dueAt] })
    .returning({ id: deliveries.id });
  return inserted.length;
}

async function assertEndpoint(db: Db | Tx, userId: string, endpointId: string) {
  const [row] = await db
    .select({ id: endpoints.id })
    .from(endpoints)
    .innerJoin(contacts, eq(contacts.id, endpoints.contactId))
    .where(and(eq(endpoints.id, endpointId), eq(contacts.userId, userId)));
  if (!row) throw new UserError("Choose who receives this wish");
}

function parseWish(raw: unknown): WishInput {
  const parsed = wishInput.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  return parsed.data;
}

function wishValues(input: WishInput) {
  return {
    endpointId: input.endpointId,
    occasion: input.occasion,
    occasionLabel: input.occasion === "custom" ? input.occasionLabel ?? null : null,
    message: input.message,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    placeIds: [...new Set(input.placeIds)],
    recurrence: input.recurrence,
    year: input.recurrence === "once" ? input.year ?? null : null,
  };
}

const PAST_ERROR = "That moment has already passed in every selected place. Choose a later date.";

export async function createWish(db: Db, userId: string, raw: unknown, now = new Date()): Promise<Wish> {
  const input = parseWish(raw);
  return db.transaction(async (tx) => {
    await assertEndpoint(tx, userId, input.endpointId);
    const [wish] = await tx.insert(wishes).values({ userId, ...wishValues(input) }).returning();
    if ((await replan(tx, wish, now)) === 0) throw new UserError(PAST_ERROR);
    return wish;
  });
}

/** Edits apply to deliveries that haven't been sent yet. Editing a cancelled or completed wish revives it. */
export async function updateWish(db: Db, userId: string, wishId: string, raw: unknown, now = new Date()): Promise<Wish> {
  const input = parseWish(raw);
  return db.transaction(async (tx) => {
    await assertEndpoint(tx, userId, input.endpointId);
    const [wish] = await tx
      .update(wishes)
      .set({ ...wishValues(input), status: "active", updatedAt: now })
      .where(and(eq(wishes.id, wishId), eq(wishes.userId, userId)))
      .returning();
    if (!wish) throw new UserError("Wish not found");
    const scheduled = await replan(tx, wish, now);
    if (scheduled === 0 && !(await hasPending(tx, wish.id))) throw new UserError(PAST_ERROR);
    return wish;
  });
}

export async function cancelWish(db: Db, userId: string, wishId: string, now = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [wish] = await tx
      .update(wishes)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(wishes.id, wishId), eq(wishes.userId, userId)))
      .returning({ id: wishes.id });
    if (!wish) throw new UserError("Wish not found");
    await tx
      .update(deliveries)
      .set({ status: "cancelled" })
      .where(and(eq(deliveries.wishId, wishId), eq(deliveries.status, "scheduled")));
  });
}

async function hasPending(tx: Tx | Db, wishId: string) {
  const rows = await tx
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(and(eq(deliveries.wishId, wishId), inArray(deliveries.status, PENDING)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Called by the worker: once an occurrence is fully done, prepare next year's
 * deliveries for yearly wishes and mark one-time wishes completed.
 */
export async function rollForward(db: Db, now = new Date()): Promise<{ replanned: number; completed: number }> {
  const idle = await db
    .select()
    .from(wishes)
    .where(
      and(
        eq(wishes.status, "active"),
        notExists(
          db
            .select({ one: sql`1` })
            .from(deliveries)
            .where(and(eq(deliveries.wishId, wishes.id), inArray(deliveries.status, PENDING))),
        ),
      ),
    );

  let replanned = 0;
  let completed = 0;
  for (const wish of idle) {
    const scheduled = wish.recurrence === "yearly" ? await replan(db, wish, now) : 0;
    if (scheduled > 0) {
      replanned++;
    } else {
      await db.update(wishes).set({ status: "completed", updatedAt: now }).where(eq(wishes.id, wish.id));
      completed++;
    }
  }
  return { replanned, completed };
}

export async function createContact(db: Db, userId: string, raw: unknown) {
  const parsed = contactInput.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) throw new UserError("Enter the number with its country code, e.g. +1 415 555 0123");

  return db.transaction(async (tx) => {
    const [contact] = await tx.insert(contacts).values({ userId, name: parsed.data.name }).returning();
    const [endpoint] = await tx
      .insert(endpoints)
      .values({ contactId: contact.id, channel: "whatsapp", address: phone })
      .returning();
    return { contact, endpoint };
  });
}

export async function updateContact(db: Db, userId: string, contactId: string, raw: unknown) {
  const parsed = contactInput.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) throw new UserError("Enter the number with its country code, e.g. +1 415 555 0123");

  await db.transaction(async (tx) => {
    const [contact] = await tx
      .update(contacts)
      .set({ name: parsed.data.name })
      .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
      .returning();
    if (!contact) throw new UserError("Contact not found");
    await tx
      .update(endpoints)
      .set({ address: phone })
      .where(and(eq(endpoints.contactId, contactId), eq(endpoints.channel, "whatsapp")));
  });
}

/** Deleting a contact also removes their finished/cancelled wishes and history. */
export async function deleteContact(db: Db, userId: string, contactId: string) {
  await db.transaction(async (tx) => {
    const theirWishes = await tx
      .select({ id: wishes.id, status: wishes.status })
      .from(wishes)
      .innerJoin(endpoints, eq(endpoints.id, wishes.endpointId))
      .where(and(eq(endpoints.contactId, contactId), eq(wishes.userId, userId)));
    if (theirWishes.some((w) => w.status === "active")) {
      throw new UserError("This contact has active wishes. Cancel them first.");
    }
    if (theirWishes.length > 0) {
      await tx.delete(wishes).where(inArray(wishes.id, theirWishes.map((w) => w.id)));
    }
    await tx.delete(contacts).where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));
  });
}
