import { getDb, pool } from "@/lib/db";
import { DeliveryEngine } from "@/lib/delivery/engine";
import { ConsoleChannel } from "./console-channel";
import { WhatsAppChannel } from "./whatsapp";

/** Arbitrary constant: only one worker may hold this lock (one socket per WhatsApp number). */
const WORKER_LOCK_ID = 7_310_026;

async function main() {
  const lockClient = await pool().connect();
  const { rows } = await lockClient.query<{ locked: boolean }>("select pg_try_advisory_lock($1) as locked", [
    WORKER_LOCK_ID,
  ]);
  if (!rows[0].locked) {
    console.error("[worker] another worker is already running; exiting");
    process.exit(1);
  }

  const db = getDb();
  const channel =
    process.env.CHANNEL === "console"
      ? new ConsoleChannel(db)
      : new WhatsAppChannel(db, (id, receipt) => {
          engine.recordReceipt(id, receipt).catch((err) => console.error("[worker] receipt failed:", err));
        });
  const engine = new DeliveryEngine(db, channel);

  await engine.recoverInterrupted();
  await channel.resumeAll();
  console.log("[worker] running");

  const loops = [
    every(2_000, () => channel.sync()),
    every(5_000, () => engine.tick()),
    every(60_000, () => engine.maintenance()),
  ];

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal}: finishing in-flight deliveries…`);
    loops.forEach((stop) => stop());
    await engine.stop();
    await channel.stop();
    lockClient.release();
    await pool().end();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

/** Run `fn` now and then every `ms`, never overlapping. Returns a stop function. */
function every(ms: number, fn: () => Promise<void>): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.error("[worker] loop error:", err);
    }
    if (!stopped) timer = setTimeout(run, ms);
  };
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
