import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, proto, type WASocket } from "baileys";
import { eq } from "drizzle-orm";
import pino from "pino";
import { raiseAlert } from "@/lib/alerts";
import { ChannelNotReadyError, type Channel } from "@/lib/channels/types";
import type { Db } from "@/lib/db";
import { whatsappSessions } from "@/lib/db/schema";
import type { Receipt } from "@/lib/delivery/engine";
import { phoneToJid } from "@/lib/phone";
import { clearAuthState, hasSavedCreds, loadPostgresAuthState } from "./auth-state";

type SessionStatus = (typeof whatsappSessions.$inferSelect)["status"];

type Connection = {
  sock: WASocket;
  open: boolean;
  /** True until the first successful open (i.e. while showing QR codes). */
  pairing: boolean;
  /** Closed on purpose (logout/shutdown): don't reconnect or alert. */
  closing?: boolean;
};

const RECEIPTS: Partial<Record<number, Receipt>> = {
  [proto.WebMessageInfo.Status.SERVER_ACK]: "server",
  [proto.WebMessageInfo.Status.DELIVERY_ACK]: "delivered",
  [proto.WebMessageInfo.Status.READ]: "read",
  [proto.WebMessageInfo.Status.PLAYED]: "read",
};

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL ?? "warn" });

/**
 * WhatsApp via the user's own number, linked as a companion device (like
 * WhatsApp Web). One socket per user; state is mirrored to whatsapp_sessions
 * so the web app can show status and the pairing QR code.
 */
export class WhatsAppChannel implements Channel {
  readonly id = "whatsapp" as const;
  private readonly connections = new Map<string, Connection>();
  private readonly reconnectAttempts = new Map<string, number>();
  private stopping = false;

  constructor(
    private readonly db: Db,
    private readonly onReceipt: (providerMessageId: string, receipt: Receipt) => void,
  ) {}

  isReady(userId: string): boolean {
    return this.connections.get(userId)?.open ?? false;
  }

  async send(userId: string, to: string, text: string) {
    const conn = this.connections.get(userId);
    if (!conn?.open) throw new ChannelNotReadyError();
    const msg = await conn.sock.sendMessage(phoneToJid(to), { text });
    return { providerMessageId: msg?.key.id ?? undefined };
  }

  async checkRecipient(userId: string, to: string): Promise<boolean | null> {
    const conn = this.connections.get(userId);
    if (!conn?.open) return null;
    try {
      const [result] = (await conn.sock.onWhatsApp(to.replace(/^\+/, ""))) ?? [];
      return result?.exists ?? false;
    } catch {
      return null;
    }
  }

  /** Reconnect every user who has linked a device before. */
  async resumeAll(): Promise<void> {
    const sessions = await this.db.select().from(whatsappSessions);
    for (const s of sessions) {
      if (await hasSavedCreds(this.db, s.userId)) await this.connect(s.userId);
    }
  }

  /** Act on "pair" / "logout" requests from the web app, and write a heartbeat. */
  async sync(): Promise<void> {
    const sessions = await this.db.select().from(whatsappSessions);
    for (const s of sessions) {
      if (s.request === "pair") {
        await this.setSession(s.userId, { request: null, lastError: null });
        if (!this.connections.has(s.userId)) await this.connect(s.userId);
      } else if (s.request === "logout") {
        await this.setSession(s.userId, { request: null });
        await this.logout(s.userId);
      }
    }
    await this.db.update(whatsappSessions).set({ heartbeatAt: new Date() });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    for (const conn of this.connections.values()) conn.sock.end(undefined);
    this.connections.clear();
  }

  private async connect(userId: string): Promise<void> {
    const { state, saveCreds } = await loadPostgresAuthState(this.db, userId);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
    const sock = makeWASocket({
      auth: state,
      logger,
      browser: Browsers.macOS("EveryWish"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      ...(version && { version }),
    });
    const conn: Connection = { sock, open: false, pairing: !state.creds.registered };
    this.connections.set(userId, conn);
    await this.setSession(userId, { status: conn.pairing ? "pairing" : "connecting", qr: null });

    sock.ev.on("creds.update", () => void saveCreds());

    sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
      if (qr) await this.setSession(userId, { status: "pairing", qr });

      if (connection === "open") {
        conn.open = true;
        conn.pairing = false;
        this.reconnectAttempts.delete(userId);
        const phone = sock.user?.id ? `+${sock.user.id.split(/[:@]/)[0]}` : null;
        await this.setSession(userId, { status: "connected", qr: null, phone, lastError: null });
        console.log(`[whatsapp] connected as ${phone}`);
      }

      if (connection === "close") {
        conn.open = false;
        if (this.connections.get(userId) === conn) this.connections.delete(userId);
        if (this.stopping || conn.closing) return;
        const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        await this.handleClose(userId, conn, code);
      }
    });

    sock.ev.on("messages.update", (updates) => {
      for (const { key, update } of updates) {
        const receipt = update.status != null ? RECEIPTS[update.status] : undefined;
        if (key.fromMe && key.id && receipt) this.onReceipt(key.id, receipt);
      }
    });
  }

  private async handleClose(userId: string, conn: Connection, code: number | undefined) {
    if (code === DisconnectReason.loggedOut) {
      await clearAuthState(this.db, userId);
      await this.setSession(userId, { status: "disconnected", qr: null, phone: null, lastError: "Logged out from the phone" });
      await raiseAlert(this.db, {
        userId,
        kind: "whatsapp-disconnected",
        message: "WhatsApp was unlinked. Reconnect it so your scheduled wishes can be sent.",
      });
      return;
    }

    // Pairing QR codes expired without a scan: stop and let the user retry.
    if (conn.pairing && code === DisconnectReason.timedOut) {
      await clearAuthState(this.db, userId);
      await this.setSession(userId, { status: "disconnected", qr: null, lastError: "The QR code expired. Try again." });
      return;
    }

    // Anything else (including the restart WhatsApp requires right after pairing): reconnect.
    const attempt = (this.reconnectAttempts.get(userId) ?? 0) + 1;
    this.reconnectAttempts.set(userId, attempt);
    const delay = code === DisconnectReason.restartRequired ? 0 : Math.min(30_000, 1_000 * 2 ** (attempt - 1));
    await this.setSession(userId, { status: "connecting", qr: null });
    console.log(`[whatsapp] connection closed (code ${code}); reconnecting in ${delay}ms`);
    setTimeout(() => {
      if (!this.stopping && !this.connections.has(userId)) {
        this.connect(userId).catch((err) => console.error("[whatsapp] reconnect failed:", err));
      }
    }, delay);
  }

  private async logout(userId: string) {
    const conn = this.connections.get(userId);
    this.connections.delete(userId);
    if (conn) conn.closing = true;
    if (conn) await conn.sock.logout().catch(() => conn.sock.end(undefined));
    await clearAuthState(this.db, userId);
    await this.setSession(userId, { status: "disconnected", qr: null, phone: null, lastError: null });
  }

  private async setSession(
    userId: string,
    patch: Partial<{
      status: SessionStatus;
      qr: string | null;
      phone: string | null;
      request: null;
      lastError: string | null;
    }>,
  ) {
    await this.db
      .update(whatsappSessions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(whatsappSessions.userId, userId));
  }
}
