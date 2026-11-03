// Builds the hosted DATABASE_URL / DIRECT_URL from .env.supabase without printing secrets.
// Usage: node scripts/supabase-env.mjs check                 -> reports which parts are present
//        node scripts/supabase-env.mjs run <command...>       -> runs a command with both URLs set
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

const env = config({ path: ".env.supabase", processEnv: {}, quiet: true }).parsed ?? {};
const { SUPABASE_DB_PASSWORD: pw, SUPABASE_POOLER_HOST: host, SUPABASE_DB_USER: user } = env;

const [mode, ...cmd] = process.argv.slice(2);
if (!pw || !host || !user) {
  console.error(`Missing in .env.supabase: ${[!pw && "SUPABASE_DB_PASSWORD", !host && "SUPABASE_POOLER_HOST", !user && "SUPABASE_DB_USER"].filter(Boolean).join(", ")}`);
  process.exit(1);
}
const enc = encodeURIComponent(pw);
const urls = {
  // Transaction pooler for serverless functions; one connection per function instance.
  DATABASE_URL: `postgresql://${user}:${enc}@${host}:6543/postgres?pgbouncer=true&connection_limit=1`,
  // Session pooler for migrations and seeding.
  DIRECT_URL: `postgresql://${user}:${enc}@${host}:5432/postgres`,
};

if (mode === "check") {
  console.log(`password: set (${pw.length} chars), host: ${host}, user: ${user}`);
  process.exit(0);
}
if (mode === "run" && cmd.length) {
  // --direct: point DATABASE_URL at the session pooler too (seeding uses many interactive transactions).
  const direct = cmd[0] === "--direct";
  const args = direct ? cmd.slice(1) : cmd;
  const runEnv = { ...process.env, ...urls, ...(direct ? { DATABASE_URL: urls.DIRECT_URL } : {}) };
  const r = spawnSync(args[0], args.slice(1), { stdio: "inherit", shell: true, env: runEnv });
  process.exit(r.status ?? 1);
}
if (mode === "value" && (cmd[0] === "DATABASE_URL" || cmd[0] === "DIRECT_URL")) {
  // Only for piping into `vercel env add NAME production` so the value never reaches a log.
  if (process.stdout.isTTY) {
    console.error("Refusing to print a secret to a terminal; pipe it into another command.");
    process.exit(1);
  }
  process.stdout.write(urls[cmd[0]]);
  process.exit(0);
}
console.error("Usage: node scripts/supabase-env.mjs check | run <command...>");
process.exit(1);
