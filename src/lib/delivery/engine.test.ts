import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Channel } from "@/lib/channels/types";
import { alerts, deliveries } from "@/lib/db/schema";
import { createWish, cancelWish } from "@/lib/wishes/service";
import { sisterBirthday, testDb } from "@/test/db";
import { DeliveryEngine } from "./engine";

const INDIA_MIDNIGHT = new Date("2026-10-05T18:30:00Z");

class FakeChannel implements Channel {
  readonly id = "whatsapp" as const;
  ready = true;
  onWhatsApp = true;
  failures = 0;
  sent: { to: string; text: string }[] = [];

  isReady() {
    return this.ready;
  }
  async send(_userId: string, to: string, text: string) {
    if (this.failures > 0) {
      this.failures--;
      throw new Error("socket hiccup");
    }
    this.sent.push({ to, text });
    return { providerMessageId: `msg-${this.sent.length}` };
  }
  async checkRecipient() {
    return this.ready ? this.onWhatsApp : null;
  }
}

let t: Awaited<ReturnType<typeof testDb>>;
let channel: FakeChannel;
let clock: Date;
let engine: DeliveryEngine;
let wishId: string;

beforeEach(async () => {
  t = await testDb();
  channel = new FakeChannel();
  clock = new Date("2026-09-01T00:00:00Z");
  engine = new DeliveryEngine(t.db, channel, {
    now: () => clock,
    sleep: async (ms) => {
      clock = new Date(clock.getTime() + ms);
    },
    log: () => {},
  });
  wishId = (await createWish(t.db, t.userId, sisterBirthday(t.endpointId), clock)).id;
});

const all = () => t.db.select().from(deliveries).orderBy(asc(deliveries.dueAt));
const india = async () => (await all())[0];
const at = (ms: number) => (clock = new Date(INDIA_MIDNIGHT.getTime() + ms));

describe("deliver", () => {
  it("sends at the moment and records what was sent", async () => {
    at(0);
    await engine.deliver((await india()).id);

    expect(channel.sent).toEqual([{ to: "+14155550123", text: "Happy Birthday ❤️ I hope you have an amazing year!" }]);
    expect(await india()).toMatchObject({
      status: "sent",
      attempts: 1,
      sentTo: "+14155550123",
      providerMessageId: "msg-1",
      sentAt: INDIA_MIDNIGHT,
    });
  });

  it("never sends early", async () => {
    at(-5_000);
    await engine.deliver((await india()).id);
    expect(channel.sent).toHaveLength(0);
    expect((await india()).status).toBe("scheduled");
  });

  it("never sends after the on-time window", async () => {
    at(61_000);
    await engine.deliver((await india()).id);
    expect(channel.sent).toHaveLength(0);
  });

  it("retries a failing send within the window", async () => {
    at(0);
    channel.failures = 2;
    await engine.deliver((await india()).id);
    expect(await india()).toMatchObject({ status: "sent", attempts: 3 });
  });

  it("gives up when the window closes and alerts", async () => {
    at(0);
    channel.failures = 1_000;
    await engine.deliver((await india()).id);

    const d = await india();
    expect(d).toMatchObject({ status: "failed", lastError: "socket hiccup" });
    expect(clock.getTime() - INDIA_MIDNIGHT.getTime()).toBeLessThanOrEqual(60_000);
    const [alert] = await t.db.select().from(alerts);
    expect(alert).toMatchObject({ kind: "failed", wishId });
    expect(alert.message).toMatch(/Sister's Birthday couldn't be sent in India/);
  });

  it("doesn't send for a cancelled wish", async () => {
    const id = (await india()).id;
    await cancelWish(t.db, t.userId, wishId, clock);
    at(0);
    await engine.deliver(id);
    expect(channel.sent).toHaveLength(0);
  });

  it("sends each delivery only once", async () => {
    at(0);
    const id = (await india()).id;
    await Promise.all([engine.deliver(id), engine.deliver(id)]);
    expect(channel.sent).toHaveLength(1);
  });
});

describe("markMissed", () => {
  it("skips and alerts once the window has passed", async () => {
    at(60_001);
    await engine.markMissed();

    const statuses = (await all()).map((d) => d.status);
    expect(statuses).toEqual(["missed", "scheduled", "scheduled"]);
    const [alert] = await t.db.select().from(alerts);
    expect(alert.message).toBe("Sister's Birthday was missed in India.");
  });
});

describe("preflight", () => {
  it("flags a disconnected WhatsApp a day ahead, alerting once", async () => {
    channel.ready = false;
    at(-20 * 3_600_000);
    await engine.preflight();
    await engine.preflight();

    const d = await india();
    expect(d.preflightStage).toBe(1);
    expect(d.preflightProblem).toMatch(/disconnected/);
    expect(await t.db.select().from(alerts)).toHaveLength(1);

    // Reconnected by the 1h check: problem clears
    channel.ready = true;
    at(-30 * 60_000);
    await engine.preflight();
    expect(await india()).toMatchObject({ preflightStage: 2, preflightProblem: null });
  });

  it("flags a number that isn't on WhatsApp", async () => {
    channel.onWhatsApp = false;
    at(-30 * 60_000);
    await engine.preflight();
    expect((await india()).preflightProblem).toMatch(/isn't on WhatsApp|doesn't seem to be on WhatsApp/);
  });
});

describe("recordReceipt", () => {
  it("only upgrades receipts", async () => {
    at(0);
    await engine.deliver((await india()).id);
    await engine.recordReceipt("msg-1", "read");
    await engine.recordReceipt("msg-1", "delivered");
    expect((await india()).receipt).toBe("read");
  });
});

describe("timers", () => {
  it("arms a precise timer and sends via tick", async () => {
    clock = new Date(Date.now());
    const [d] = await t.db
      .update(deliveries)
      .set({ dueAt: new Date(clock.getTime() + 50) })
      .where(eq(deliveries.id, (await india()).id))
      .returning();
    const live = new DeliveryEngine(t.db, channel, { log: () => {} });
    await live.tick();
    await new Promise((r) => setTimeout(r, 300));
    await live.stop();

    expect(channel.sent).toHaveLength(1);
    expect((await t.db.select().from(deliveries).where(eq(deliveries.id, d.id)))[0].status).toBe("sent");
  });
});
