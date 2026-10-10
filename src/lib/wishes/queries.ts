import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  alerts,
  contacts,
  deliveries,
  endpoints,
  whatsappSessions,
  wishes,
  type Delivery,
  type DeliveryStatus,
  type Wish,
} from "../db/schema";

export type WishView = Wish & {
  contactName: string;
  address: string;
  /** Deliveries of the occurrence to show: the next one, or the latest finished. */
  current: Delivery[];
};

const PENDING: DeliveryStatus[] = ["scheduled", "sending"];

/** Wishes with the deliveries of their current occurrence. */
export async function listWishes(db: Db, userId: string, statuses: Wish["status"][]): Promise<WishView[]> {
  const rows = await db
    .select({ wish: wishes, contactName: contacts.name, address: endpoints.address })
    .from(wishes)
    .innerJoin(endpoints, eq(endpoints.id, wishes.endpointId))
    .innerJoin(contacts, eq(contacts.id, endpoints.contactId))
    .where(and(eq(wishes.userId, userId), inArray(wishes.status, statuses)))
    .orderBy(desc(wishes.updatedAt));
  if (rows.length === 0) return [];

  const all = await db
    .select()
    .from(deliveries)
    .where(
      and(
        inArray(
          deliveries.wishId,
          rows.map((r) => r.wish.id),
        ),
        ne(deliveries.status, "cancelled"),
      ),
    )
    .orderBy(asc(deliveries.dueAt));

  const views = rows.map(({ wish, contactName, address }) => {
    const mine = all.filter((d) => d.wishId === wish.id);
    const pendingYears = mine.filter((d) => PENDING.includes(d.status)).map((d) => d.occurrenceYear);
    const year = pendingYears.length ? Math.min(...pendingYears) : Math.max(0, ...mine.map((d) => d.occurrenceYear));
    return { ...wish, contactName, address, current: mine.filter((d) => d.occurrenceYear === year) };
  });

  // Soonest upcoming first; finished ones keep most-recently-updated order after.
  const nextDue = (v: WishView) =>
    v.current.find((d) => PENDING.includes(d.status))?.dueAt.getTime() ?? Number.POSITIVE_INFINITY;
  return views.sort((a, b) => nextDue(a) - nextDue(b));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getWish(db: Db, userId: string, wishId: string) {
  if (!UUID.test(wishId)) return null;
  const [row] = await db
    .select({ wish: wishes, contactName: contacts.name, address: endpoints.address })
    .from(wishes)
    .innerJoin(endpoints, eq(endpoints.id, wishes.endpointId))
    .innerJoin(contacts, eq(contacts.id, endpoints.contactId))
    .where(and(eq(wishes.id, wishId), eq(wishes.userId, userId)));
  if (!row) return null;
  const history = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.wishId, wishId), ne(deliveries.status, "cancelled")))
    .orderBy(desc(deliveries.dueAt));
  return { ...row.wish, contactName: row.contactName, address: row.address, deliveries: history };
}

export type DeliveryView = Delivery & {
  wishMessage: string;
  occasion: Wish["occasion"];
  occasionLabel: string | null;
  contactName: string;
};

export async function listDeliveries(db: Db, userId: string, statuses: DeliveryStatus[], limit = 200) {
  const rows = await db
    .select({
      delivery: deliveries,
      wishMessage: wishes.message,
      occasion: wishes.occasion,
      occasionLabel: wishes.occasionLabel,
      contactName: contacts.name,
    })
    .from(deliveries)
    .innerJoin(wishes, eq(wishes.id, deliveries.wishId))
    .innerJoin(endpoints, eq(endpoints.id, wishes.endpointId))
    .innerJoin(contacts, eq(contacts.id, endpoints.contactId))
    .where(and(eq(deliveries.userId, userId), inArray(deliveries.status, statuses)))
    .orderBy(PENDING.some((s) => statuses.includes(s)) ? asc(deliveries.dueAt) : desc(deliveries.dueAt))
    .limit(limit);
  return rows.map(({ delivery, ...rest }): DeliveryView => ({ ...delivery, ...rest }));
}

export async function deliveryCounts(db: Db, userId: string) {
  const rows = await db
    .select({ status: deliveries.status, count: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(eq(deliveries.userId, userId))
    .groupBy(deliveries.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.count])) as Partial<Record<DeliveryStatus, number>>;
}

export async function listContacts(db: Db, userId: string) {
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      endpointId: endpoints.id,
      address: endpoints.address,
      activeWishes: sql<number>`(select count(*)::int from ${wishes} where ${wishes.endpointId} = ${endpoints.id} and ${wishes.status} = 'active')`,
    })
    .from(contacts)
    .innerJoin(endpoints, and(eq(endpoints.contactId, contacts.id), eq(endpoints.channel, "whatsapp")))
    .where(eq(contacts.userId, userId))
    .orderBy(asc(contacts.name));
}

export async function listAlerts(db: Db, userId: string) {
  return db
    .select()
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.dismissed, false)))
    .orderBy(desc(alerts.createdAt))
    .limit(10);
}

export async function getWhatsAppSession(db: Db, userId: string) {
  const [session] = await db.select().from(whatsappSessions).where(eq(whatsappSessions.userId, userId));
  return session ?? null;
}

/** The worker writes a heartbeat every few seconds; older than this means it's down. */
const WORKER_STALE_MS = 30_000;

/** Session plus whether the sender process is alive and WhatsApp is linked. */
export async function getSenderHealth(db: Db, userId: string, now = new Date()) {
  const session = await getWhatsAppSession(db, userId);
  const workerOnline = !!session?.heartbeatAt && now.getTime() - session.heartbeatAt.getTime() < WORKER_STALE_MS;
  return { session, workerOnline, connected: workerOnline && session?.status === "connected" };
}
