import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createContact } from "@/lib/wishes/service";

/** A fresh in-memory Postgres with the real migrations applied. */
export async function testDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  const [user] = await db.insert(schema.users).values({ name: "Me" }).returning();
  const { endpoint } = await createContact(db as unknown as Db, user.id, { name: "Sister", phone: "+1 415 555 0123" });
  return { db: db as unknown as Db, client, userId: user.id, endpointId: endpoint.id };
}

export function sisterBirthday(endpointId: string) {
  return {
    endpointId,
    occasion: "birthday" as const,
    message: "Happy Birthday ❤️ I hope you have an amazing year!",
    month: 10,
    day: 6,
    hour: 0,
    minute: 0,
    placeIds: ["india", "new-york", "california"],
    recurrence: "yearly" as const,
  };
}
