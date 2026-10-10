/**
 * A local Postgres for development, no Docker needed (PGlite over the
 * Postgres wire protocol). Data lives in .data/pglite.
 *   DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres
 */
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

async function main() {
  const port = Number(process.env.LOCAL_DB_PORT ?? 54329);
  mkdirSync(".data", { recursive: true });
  const db = await PGlite.create(".data/pglite");
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 30 });
  await server.start();
  console.log(`Local Postgres ready: postgres://postgres@127.0.0.1:${port}/postgres`);

  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
