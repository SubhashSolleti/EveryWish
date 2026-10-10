import type { Db } from "./db";
import { alerts } from "./db/schema";

type AlertKind = (typeof alerts.$inferInsert)["kind"];

/**
 * Tell the user something needs attention: always on the dashboard, and by
 * email when configured (WhatsApp can't be trusted to report its own failure).
 */
export async function raiseAlert(
  db: Db,
  alert: { userId: string; kind: AlertKind; message: string; wishId?: string },
): Promise<void> {
  await db.insert(alerts).values(alert);
  await sendEmail(`EveryWish: ${alert.message}`, alert.message).catch((err) =>
    console.error("[alerts] email failed:", err),
  );
}

async function sendEmail(subject: string, text: string) {
  const { RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !ALERT_EMAIL_TO) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM ?? "EveryWish <onboarding@resend.dev>",
      to: ALERT_EMAIL_TO,
      subject,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}
