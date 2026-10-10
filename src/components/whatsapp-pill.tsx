import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSenderHealth } from "@/lib/wishes/queries";

export async function WhatsAppPill() {
  const userId = await requireUserId();
  const { workerOnline: workerUp, connected } = await getSenderHealth(getDb(), userId);

  return (
    <Link
      href="/whatsapp"
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
        connected ? "border-line text-muted" : "border-bad/30 bg-bad-soft text-bad"
      }`}
    >
      <span className={`size-2 rounded-full ${connected ? "bg-ok" : "bg-bad"}`} />
      {connected ? "WhatsApp connected" : workerUp ? "Connect WhatsApp" : "Sender offline"}
    </Link>
  );
}
