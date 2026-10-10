import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/** Any Postgres-backed Drizzle database (node-postgres in the app, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { everywishPool?: Pool };

export function pool(): Pool {
  if (!globalForDb.everywishPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalForDb.everywishPool = new Pool({ connectionString, max: 5 });
  }
  return globalForDb.everywishPool;
}

let instance: Db | undefined;

export function getDb(): Db {
  instance ??= drizzle(pool(), { schema }) as unknown as Db;
  return instance;
}

export { schema };
