import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "baileys";
import { and, eq, inArray } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/crypto";
import type { Db } from "@/lib/db";
import { whatsappAuth } from "@/lib/db/schema";

/**
 * Baileys auth state stored (encrypted) in Postgres, so the linked device
 * survives restarts and redeploys without re-scanning the QR code.
 */
export async function loadPostgresAuthState(db: Db, userId: string) {
  const read = async (keys: string[]): Promise<Map<string, unknown>> => {
    if (keys.length === 0) return new Map();
    const rows = await db
      .select()
      .from(whatsappAuth)
      .where(and(eq(whatsappAuth.userId, userId), inArray(whatsappAuth.key, keys)));
    return new Map(rows.map((r) => [r.key, JSON.parse(decrypt(r.value), BufferJSON.reviver)]));
  };

  const write = async (key: string, value: unknown) => {
    const sealed = encrypt(JSON.stringify(value, BufferJSON.replacer));
    await db
      .insert(whatsappAuth)
      .values({ userId, key, value: sealed })
      .onConflictDoUpdate({ target: [whatsappAuth.userId, whatsappAuth.key], set: { value: sealed } });
  };

  const creds = ((await read(["creds"])).get("creds") as AuthenticationCreds | undefined) ?? initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const found = await read(ids.map((id) => `${type}-${id}`));
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          let value = found.get(`${type}-${id}`);
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value as object);
          }
          if (value) result[id] = value as SignalDataTypeMap[T];
        }
        return result;
      },
      set: async (data) => {
        const removals: string[] = [];
        const writes: Promise<void>[] = [];
        for (const category in data) {
          const entries = data[category as keyof SignalDataTypeMap] ?? {};
          for (const id in entries) {
            const key = `${category}-${id}`;
            const value = entries[id];
            if (value) writes.push(write(key, value));
            else removals.push(key);
          }
        }
        await Promise.all(writes);
        if (removals.length > 0) {
          await db.delete(whatsappAuth).where(and(eq(whatsappAuth.userId, userId), inArray(whatsappAuth.key, removals)));
        }
      },
    },
  };

  return { state, saveCreds: () => write("creds", creds) };
}

export async function hasSavedCreds(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ key: whatsappAuth.key })
    .from(whatsappAuth)
    .where(and(eq(whatsappAuth.userId, userId), eq(whatsappAuth.key, "creds")));
  return rows.length > 0;
}

export async function clearAuthState(db: Db, userId: string): Promise<void> {
  await db.delete(whatsappAuth).where(eq(whatsappAuth.userId, userId));
}
