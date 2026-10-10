import QRCode from "qrcode";
import { currentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSenderHealth } from "@/lib/wishes/queries";

export type WhatsAppStatus = {
  status: "disconnected" | "connecting" | "pairing" | "connected";
  workerOnline: boolean;
  phone: string | null;
  qr: string | null; // data URL
  lastError: string | null;
};

/** Polled by the connect page while pairing. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { session, workerOnline } = await getSenderHealth(getDb(), userId);
  const body: WhatsAppStatus = {
    status: session?.status ?? "disconnected",
    workerOnline,
    phone: session?.phone ?? null,
    qr: session?.status === "pairing" && session.qr ? await QRCode.toDataURL(session.qr, { margin: 1, width: 280 }) : null,
    lastError: session?.lastError ?? null,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
