import type { Channel } from "@/lib/channels/types";
import type { Db } from "@/lib/db";
import { whatsappSessions } from "@/lib/db/schema";

/**
 * Development stand-in for WhatsApp (CHANNEL=console): prints messages
 * instead of sending them, so the whole flow can be tried without a phone.
 */
export class ConsoleChannel implements Channel {
  readonly id = "whatsapp" as const;
  private count = 0;

  constructor(private readonly db: Db) {}

  isReady() {
    return true;
  }

  async send(_userId: string, to: string, text: string) {
    console.log(`\n📨 [console channel] ${new Date().toISOString()} → ${to}\n   ${text}\n`);
    return { providerMessageId: `console-${Date.now()}-${++this.count}` };
  }

  async checkRecipient() {
    return true;
  }

  async sync() {
    await this.db
      .update(whatsappSessions)
      .set({ status: "connected", phone: "console (dev)", qr: null, request: null, heartbeatAt: new Date() });
  }

  async resumeAll() {}
  async stop() {}
}
