"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, endSession, ensureOwner, requireUserId, startSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { alerts, whatsappSessions } from "@/lib/db/schema";
import {
  UserError,
  cancelWish,
  createContact,
  createWish,
  deleteContact,
  updateContact,
  updateWish,
} from "@/lib/wishes/service";

export type ActionResult = { error?: string };

async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: T } | { error: string }> {
  try {
    return { ok: await fn() };
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
}

export async function login(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (!(await checkPassword(String(form.get("password") ?? "")))) {
    return { error: "That password isn't right" };
  }
  await startSession(await ensureOwner());
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function saveWish(wishId: string | null, input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await attempt(() =>
    wishId ? updateWish(getDb(), userId, wishId, input) : createWish(getDb(), userId, input),
  );
  if ("error" in result) return result;
  revalidatePath("/", "layout");
  redirect(`/?saved=${result.ok.id}`);
}

export async function cancelWishAction(wishId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await attempt(() => cancelWish(getDb(), userId, wishId));
  if ("error" in result) return result;
  revalidatePath("/", "layout");
  return {};
}

export type ContactResult = ActionResult & {
  contact?: { id: string; endpointId: string; name: string; address: string };
};

export async function saveContact(contactId: string | null, input: { name: string; phone: string }): Promise<ContactResult> {
  const userId = await requireUserId();
  const db = getDb();
  if (contactId) {
    const result = await attempt(() => updateContact(db, userId, contactId, input));
    if ("error" in result) return result;
    revalidatePath("/", "layout");
    return {};
  }
  const result = await attempt(() => createContact(db, userId, input));
  if ("error" in result) return result;
  revalidatePath("/", "layout");
  const { contact, endpoint } = result.ok;
  return { contact: { id: contact.id, endpointId: endpoint.id, name: contact.name, address: endpoint.address } };
}

export async function deleteContactAction(contactId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await attempt(() => deleteContact(getDb(), userId, contactId));
  if ("error" in result) return result;
  revalidatePath("/", "layout");
  return {};
}

export async function dismissAlert(alertId: string): Promise<void> {
  const userId = await requireUserId();
  await getDb()
    .update(alerts)
    .set({ dismissed: true })
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)));
  revalidatePath("/", "layout");
}

/** Ask the worker to start pairing (show a QR code) or to unlink WhatsApp. */
export async function requestWhatsApp(request: "pair" | "logout"): Promise<void> {
  const userId = await requireUserId();
  await getDb()
    .update(whatsappSessions)
    .set({ request, ...(request === "pair" && { status: "connecting" as const, lastError: null }) })
    .where(eq(whatsappSessions.userId, userId));
  revalidatePath("/whatsapp");
}
