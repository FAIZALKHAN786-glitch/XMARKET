#!/usr/bin/env node
/**
 * A local Postgres for development and for verifying the persistence layer
 * without installing a server.
 *
 *   node scripts/dev-postgres.mjs          # start, print DATABASE_URL, stay up
 *
 * Then run the app against it:
 *
 *   DATABASE_URL=postgres://xmarket:xmarket@127.0.0.1:55432/xmarket npm run dev
 *
 * The data directory is .pgdata/ in the repo root (gitignored). Delete it to
 * start from an empty database.
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";

const PORT = Number(process.env.PGPORT ?? 55432);
const USER = process.env.PGUSER ?? "xmarket";
const PASSWORD = process.env.PGPASSWORD ?? "xmarket";
const DATABASE = process.env.PGDATABASE ?? "xmarket";
const DATA_DIR = path.join(process.cwd(), ".pgdata");

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  database: DATABASE,
  persistent: true,
});

process.on("SIGINT", async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
});

await pg.initialise();
await pg.start();

// The bundled launcher creates the cluster but not a named database, so make
// sure the one we advertise actually exists.
{
  const { default: pgLib } = await import("pg");
  const admin = new pgLib.Client({
    connectionString: `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/postgres`,
  });
  await admin.connect();
  const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DATABASE]);
  if (found.rowCount === 0) await admin.query(`CREATE DATABASE ${DATABASE}`);
  await admin.end();
}

const url = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;
console.log(`\n  Postgres ready on 127.0.0.1:${PORT}`);
console.log(`  data dir   ${DATA_DIR}`);
console.log(`\n  DATABASE_URL=${url}\n`);
console.log("  Press Ctrl-C to stop.\n");

// Hold the process open until signalled.
setInterval(() => {}, 1 << 30);
