import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "./db";
import { users, whatsappSessions } from "./db/schema";

/**
 * Single-owner auth for now: one password (APP_PASSWORD) unlocks the app.
 * Every row is already keyed by user_id, so real accounts can slot in later.
 */
export const SESSION_COOKIE = "ew_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function checkPassword(password: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  return safeEqual(password, expected);
}

/** The single owner account, created on first login. */
export async function ensureOwner(): Promise<string> {
  const db = getDb();
  let [owner] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  owner ??= (await db.insert(users).values({ name: "Me" }).returning())[0];
  await db.insert(whatsappSessions).values({ userId: owner.id }).onConflictDoNothing();
  return owner.id;
}

export async function startSession(userId: string): Promise<void> {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUserId(): Promise<string | null> {
  await connection(); // personal data: always render per request, never prerender
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const [userId, expires, signature] = value.split(".");
  if (!userId || !expires || !signature) return null;
  if (!safeEqual(signature, sign(`${userId}.${expires}`))) return null;
  if (Number(expires) < Date.now()) return null;
  return userId;
}

/** Use at the top of every data read and server action. */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  return userId;
}
