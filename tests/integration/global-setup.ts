import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Apply all migrations to the test database once per run. */
export default function setup() {
  config({ quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is required for integration tests");
  execSync("pnpm exec prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
