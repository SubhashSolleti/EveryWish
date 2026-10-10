import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const userRef = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    userId: userRef(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("contacts_user_idx").on(t.userId)],
);

/** How to reach a contact on one channel. MVP only uses "whatsapp". */
export const endpoints = pgTable(
  "endpoints",
  {
    id: id(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["whatsapp"] }).notNull(),
    /** WhatsApp: E.164 phone number, e.g. "+14155550123". */
    address: text("address").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("endpoints_contact_channel_idx").on(t.contactId, t.channel)],
);

export const OCCASIONS = [
  "birthday",
  "anniversary",
  "festival",
  "new-year",
  "valentines",
  "graduation",
  "custom",
] as const;
export type Occasion = (typeof OCCASIONS)[number];

/**
 * A wish is the user's rule: what to say, to whom, at which local moment, in
 * which places. It never stores UTC — deliveries are derived from it.
 */
export const wishes = pgTable(
  "wishes",
  {
    id: id(),
    userId: userRef(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "restrict" }),
    occasion: text("occasion", { enum: OCCASIONS }).notNull(),
    /** Name for "custom" occasions, e.g. "Mom's retirement". */
    occasionLabel: text("occasion_label"),
    message: text("message").notNull(),
    month: smallint("month").notNull(),
    day: smallint("day").notNull(),
    hour: smallint("hour").notNull(),
    minute: smallint("minute").notNull(),
    placeIds: text("place_ids").array().notNull(),
    recurrence: text("recurrence", { enum: ["once", "yearly"] }).notNull(),
    /** Only for one-time wishes. */
    year: integer("year"),
    status: text("status", { enum: ["active", "completed", "cancelled"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wishes_user_status_idx").on(t.userId, t.status)],
);

export type DeliveryPlace = {
  placeId: string;
  localDate: string;
  localTime: string;
  adjusted?: "leap-day" | "dst-gap";
};

export const DELIVERY_STATUSES = [
  "scheduled",
  "sending",
  "sent",
  "failed",
  "missed",
  "cancelled",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/**
 * One message send at one instant. Places that reach the wish's local moment
 * at the same instant share a delivery.
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: id(),
    userId: userRef(),
    wishId: uuid("wish_id")
      .notNull()
      .references(() => wishes.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    occurrenceYear: integer("occurrence_year").notNull(),
    places: jsonb("places").$type<DeliveryPlace[]>().notNull(),
    status: text("status", { enum: DELIVERY_STATUSES }).notNull().default("scheduled"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** Snapshot of what was actually sent, kept even if the wish changes later. */
    sentTo: text("sent_to"),
    sentMessage: text("sent_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    receipt: text("receipt", { enum: ["server", "delivered", "read"] }),
    /** 0 = not checked, 1 = checked ~24h before, 2 = checked ~1h before. */
    preflightStage: smallint("preflight_stage").notNull().default(0),
    preflightProblem: text("preflight_problem"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("deliveries_wish_due_idx").on(t.wishId, t.dueAt),
    index("deliveries_due_idx")
      .on(t.dueAt)
      .where(sql`${t.status} = 'scheduled'`),
    index("deliveries_user_status_idx").on(t.userId, t.status),
    index("deliveries_provider_msg_idx").on(t.providerMessageId),
  ],
);

/** Linked WhatsApp device state, written by the worker, read by the web app. */
export const whatsappSessions = pgTable("whatsapp_sessions", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["disconnected", "connecting", "pairing", "connected"] })
    .notNull()
    .default("disconnected"),
  qr: text("qr"),
  phone: text("phone"),
  /** Set by the web app; the worker acts on it and clears it. */
  request: text("request", { enum: ["pair", "logout"] }),
  lastError: text("last_error"),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Baileys credentials and signal keys, encrypted at rest. */
export const whatsappAuth = pgTable(
  "whatsapp_auth",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Things the user must know about: missed/failed wishes, disconnections. */
export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    userId: userRef(),
    kind: text("kind", {
      enum: ["missed", "failed", "whatsapp-disconnected", "preflight"],
    }).notNull(),
    message: text("message").notNull(),
    wishId: uuid("wish_id").references(() => wishes.id, { onDelete: "cascade" }),
    dismissed: boolean("dismissed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("alerts_user_idx").on(t.userId, t.dismissed)],
);

export type Wish = typeof wishes.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Endpoint = typeof endpoints.$inferSelect;
