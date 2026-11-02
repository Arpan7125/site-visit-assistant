// Fallback for machines without Docker: runs a real PostgreSQL 17 (embedded-postgres ships the
// official binaries) on port 5432 with the same user and databases as docker-compose.yml.
// Usage: pnpm db:local   (Ctrl+C to stop; data persists in .localdb/)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = ".localdb";
const fresh = !existsSync(dir);
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "app",
  password: "app",
  port: 5432,
  persistent: true,
  // Windows defaults to WIN1252, which cannot store Hindi or Gujarati.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (fresh) await pg.initialise();
await pg.start();
for (const name of ["sitevisit", "sitevisit_test"]) {
  try {
    await pg.createDatabase(name);
  } catch {
    // already exists
  }
}
console.log("PostgreSQL ready on localhost:5432 (databases: sitevisit, sitevisit_test)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
