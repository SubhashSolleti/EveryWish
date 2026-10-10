import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, pool } from "@/lib/db";

async function main() {
  await migrate(getDb() as Parameters<typeof migrate>[0], { migrationsFolder: "./drizzle" });
  console.log("Database is up to date.");
  await pool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
