import { execSync } from "node:child_process";
import { config } from "dotenv";

/**
 * Apply pending migrations to the test database once per run (non-destructive).
 * Tests truncate tables themselves, so refuse anything that is not a local *_test database.
 */
export default function setup() {
  config({ quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is required for integration tests");
  const { hostname, pathname } = new URL(url);
  const local = ["localhost", "127.0.0.1", "db", "postgres"].includes(hostname);
  if (!local || !pathname.endsWith("_test")) {
    throw new Error(`Refusing to run integration tests against ${hostname}${pathname}: expected a local *_test database`);
  }
  execSync("pnpm exec prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
