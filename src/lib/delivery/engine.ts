import { and, eq, exists, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { raiseAlert } from "../alerts";
import type { Channel } from "../channels/types";
import type { Db } from "../db";
import { contacts, deliveries, endpoints, wishes } from "../db/schema";
import { wishTitle } from "../occasions";
import { getPlace } from "../schedule/places";
import { rollForward } from "../wishes/service";

/** A wish is sent at its moment or not at all: this is the latest acceptable send. */
export const ON_TIME_WINDOW_MS = 60_000;
const RETRY_DELAY_MS = 3_000;
/** Arm a precise timer for deliveries due within this horizon. */
const ARM_HORIZON_MS = 2 * 60_000;
/** Allow a timer that fires a touch early (clock drift) to still send. */
const EARLY_TOLERANCE_MS = 1_000;

const HOUR = 60 * 60_000;
const PREFLIGHT_STAGES = [
  { stage: 1, within: 24 * HOUR },
  { stage: 2, within: HOUR },
] as const;

const RECEIPT_RANK = { server: 1, delivered: 2, read: 3 } as const;
export type Receipt = keyof typeof RECEIPT_RANK;

type EngineOptions = {
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
};

/**
 * Sends each delivery at its exact moment. Deliveries that can't go out within
 * ON_TIME_WINDOW_MS are marked missed (never sent late) and the user is alerted.
 */
export class DeliveryEngine {
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: (msg: string) => void;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly db: Db,
    private readonly channel: Channel,
    opts: EngineOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.log = opts.log ?? ((msg) => console.log(`[engine] ${msg}`));
  }

  /** On startup: anything left "sending" was interrupted by a crash. */
  async recoverInterrupted(): Promise<void> {
    const stuck = await this.db
      .update(deliveries)
      .set({ status: "failed", lastError: "Interrupted while sending — it may or may not have arrived" })
      .where(eq(deliveries.status, "sending"))
      .returning({ id: deliveries.id, userId: deliveries.userId, wishId: deliveries.wishId });
    for (const d of stuck) {
      await raiseAlert(this.db, {
        userId: d.userId,
        wishId: d.wishId,
        kind: "failed",
        message: "A wish was interrupted while sending and may not have arrived.",
      });
    }
  }

  /** Run every few seconds. */
  async tick(): Promise<void> {
    await this.markMissed();
    await this.armUpcoming();
  }

  /** Run every minute. */
  async maintenance(): Promise<void> {
    await this.preflight();
    const { replanned, completed } = await rollForward(this.db, this.now());
    if (replanned || completed) this.log(`rolled forward ${replanned} yearly wish(es), completed ${completed}`);
  }

  async stop(): Promise<void> {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    await Promise.allSettled(this.inFlight);
  }

  private async armUpcoming() {
    const now = this.now();
    const due = await this.db
      .select({ id: deliveries.id, dueAt: deliveries.dueAt })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.status, "scheduled"),
          gte(deliveries.dueAt, new Date(now.getTime() - ON_TIME_WINDOW_MS)),
          lte(deliveries.dueAt, new Date(now.getTime() + ARM_HORIZON_MS)),
        ),
      );

    for (const d of due) {
      if (this.timers.has(d.id)) continue;
      const delay = Math.max(0, d.dueAt.getTime() - now.getTime());
      const timer = setTimeout(() => {
        const run = this.deliver(d.id)
          .catch((err) => this.log(`delivery ${d.id} crashed: ${err}`))
          .finally(() => {
            this.timers.delete(d.id);
            this.inFlight.delete(run);
          });
        this.inFlight.add(run);
      }, delay);
      this.timers.set(d.id, timer);
    }
  }

  /** Send one delivery now, retrying until the on-time window closes. */
  async deliver(deliveryId: string): Promise<void> {
    const now = this.now();
    const [claimed] = await this.db
      .update(deliveries)
      .set({ status: "sending" })
      .where(
        and(
          eq(deliveries.id, deliveryId),
          eq(deliveries.status, "scheduled"),
          lte(deliveries.dueAt, new Date(now.getTime() + EARLY_TOLERANCE_MS)),
          gte(deliveries.dueAt, new Date(now.getTime() - ON_TIME_WINDOW_MS)),
          exists(
            this.db
              .select({ one: sql`1` })
              .from(wishes)
              .where(and(eq(wishes.id, deliveries.wishId), eq(wishes.status, "active"))),
          ),
        ),
      )
      .returning();
    if (!claimed) return;

    const [target] = await this.db
      .select({ message: wishes.message, address: endpoints.address })
      .from(wishes)
      .innerJoin(endpoints, eq(endpoints.id, wishes.endpointId))
      .where(eq(wishes.id, claimed.wishId));

    const deadline = claimed.dueAt.getTime() + ON_TIME_WINDOW_MS;
    let attempts = claimed.attempts;
    for (;;) {
      attempts++;
      try {
        const { providerMessageId } = await this.channel.send(claimed.userId, target.address, target.message);
        await this.db
          .update(deliveries)
          .set({
            status: "sent",
            attempts,
            sentAt: this.now(),
            sentTo: target.address,
            sentMessage: target.message,
            providerMessageId: providerMessageId ?? null,
            lastError: null,
          })
          .where(eq(deliveries.id, claimed.id));
        this.log(`sent ${claimed.id} (${placeLabels(claimed.places)})`);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const canRetry = this.now().getTime() + RETRY_DELAY_MS < deadline;
        await this.db
          .update(deliveries)
          .set({ attempts, lastError: message, ...(!canRetry && { status: "failed" as const }) })
          .where(eq(deliveries.id, claimed.id));
        if (!canRetry) {
          this.log(`failed ${claimed.id}: ${message}`);
          await this.alertFor(
            claimed.wishId,
            "failed",
            (title) => `${title} couldn't be sent in ${placeLabels(claimed.places)}: ${message}`,
          );
          return;
        }
        await this.sleep(RETRY_DELAY_MS);
      }
    }
  }

  /** Anything still scheduled after its window closed will never be sent. */
  async markMissed(): Promise<void> {
    const cutoff = new Date(this.now().getTime() - ON_TIME_WINDOW_MS);
    const missed = await this.db
      .update(deliveries)
      .set({ status: "missed", lastError: "Not sent on time, so it was skipped" })
      .where(and(eq(deliveries.status, "scheduled"), lt(deliveries.dueAt, cutoff)))
      .returning({ wishId: deliveries.wishId, places: deliveries.places });

    for (const d of missed) {
      this.log(`missed delivery for wish ${d.wishId}`);
      await this.alertFor(d.wishId, "missed", (title) => `${title} was missed in ${placeLabels(d.places)}.`);
    }
  }

  /** Check ~24h and ~1h ahead that WhatsApp is connected and the number is valid. */
  async preflight(): Promise<void> {
    const now = this.now().getTime();
    const rows = await this.db
      .select({
        id: deliveries.id,
        userId: deliveries.userId,
        wishId: deliveries.wishId,
        dueAt: deliveries.dueAt,
        stage: deliveries.preflightStage,
        problem: deliveries.preflightProblem,
        address: endpoints.address,
      })
      .from(deliveries)
      .innerJoin(wishes, eq(wishes.id, deliveries.wishId))
      .innerJoin(endpoints, eq(endpoints.id, wishes.endpointId))
      .where(
        and(
          eq(deliveries.status, "scheduled"),
          or(
            ...PREFLIGHT_STAGES.map(({ stage, within }) =>
              and(lt(deliveries.preflightStage, stage), lte(deliveries.dueAt, new Date(now + within))),
            ),
          ),
        ),
      );

    for (const row of rows) {
      const stage = Math.max(
        ...PREFLIGHT_STAGES.filter((s) => row.dueAt.getTime() - now <= s.within).map((s) => s.stage),
      );
      let problem: string | null = null;
      if (!this.channel.isReady(row.userId)) {
        problem = "WhatsApp is disconnected — reconnect it so this wish can be sent.";
      } else if ((await this.channel.checkRecipient(row.userId, row.address)) === false) {
        problem = `${row.address} doesn't seem to be on WhatsApp.`;
      }

      await this.db
        .update(deliveries)
        .set({ preflightStage: stage, preflightProblem: problem })
        .where(eq(deliveries.id, row.id));
      if (problem && problem !== row.problem) {
        const inHours = Math.max(1, Math.round((row.dueAt.getTime() - now) / HOUR));
        await this.alertFor(row.wishId, "preflight", (title) => `${title} is due in ~${inHours}h: ${problem}`);
      }
    }
  }

  /** Upgrade a sent delivery's receipt (server → delivered → read); never downgrade. */
  async recordReceipt(providerMessageId: string, receipt: Receipt): Promise<void> {
    const lower = (Object.keys(RECEIPT_RANK) as Receipt[]).filter((r) => RECEIPT_RANK[r] < RECEIPT_RANK[receipt]);
    const upgradable = lower.length
      ? or(isNull(deliveries.receipt), inArray(deliveries.receipt, lower))
      : isNull(deliveries.receipt);
    await this.db
      .update(deliveries)
      .set({ receipt })
      .where(and(eq(deliveries.providerMessageId, providerMessageId), upgradable));
  }

  private async alertFor(wishId: string, kind: "missed" | "failed" | "preflight", text: (title: string) => string) {
    const [w] = await this.db
      .select({ userId: wishes.userId, occasion: wishes.occasion, label: wishes.occasionLabel, name: contacts.name })
      .from(wishes)
      .innerJoin(endpoints, eq(endpoints.id, wishes.endpointId))
      .innerJoin(contacts, eq(contacts.id, endpoints.contactId))
      .where(eq(wishes.id, wishId));
    if (!w) return;
    await raiseAlert(this.db, { userId: w.userId, wishId, kind, message: text(wishTitle(w.name, w.occasion, w.label)) });
  }
}

function placeLabels(places: { placeId: string }[]): string {
  return places.map((p) => getPlace(p.placeId).label).join(", ");
}
