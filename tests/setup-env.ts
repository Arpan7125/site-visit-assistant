import { config } from "dotenv";

config({ quiet: true });
process.env.PHONE_HASH_SECRET ??= "test-phone-hash-secret";
process.env.AI_DEADLINE_MS ??= "8000";
process.env.LINK_SIGNING_SECRET ??= "test-link-signing-secret";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.AUTH_SECRET ??= "test-auth-secret";
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
