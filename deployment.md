# Deployment and local setup

Real estate lead-response and site-visit booking assistant (Company A, Ahmedabad).
Next.js 15 + PostgreSQL (Prisma) + Claude (Anthropic API). All people and numbers in the demo data are fictional.

## 1. Run it locally

Prerequisites: Node.js 20+ (22 recommended), pnpm 9 (`npm i -g pnpm@9`), Docker Desktop.

```bash
git clone <repo-url> site-visit-assistant
cd site-visit-assistant
pnpm install
cp .env.example .env
```

Fill `.env` (names are listed in section 3). For local use:

```bash
DATABASE_URL=postgresql://app:app@localhost:5432/sitevisit
DATABASE_URL_TEST=postgresql://app:app@localhost:5432/sitevisit_test
APP_BASE_URL=http://localhost:3000
MOCK_MESSAGING=true
```

Generate the four secrets (`AUTH_SECRET`, `LINK_SIGNING_SECRET`, `PHONE_HASH_SECRET`, `CRON_SECRET`) with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`ANTHROPIC_API_KEY` is optional locally. Without it the chat still works for booking (slot picker), opt-out, "talk to a person" and discount questions; free-text questions take the honest outage path ("a person will reply") and are handed off.

Start the database, migrate, seed and run:

```bash
docker compose up -d --wait
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. To wipe and re-seed demo data: `pnpm db:seed -- --reset`.

**No Docker?** `pnpm db:local` runs the official PostgreSQL 17 binaries (via `embedded-postgres`) on the same port with the same user and databases. Keep it running in its own terminal and use the commands above unchanged.

Tests:

```bash
pnpm test          # unit (no database)
pnpm test:int      # integration (needs the docker database; uses DATABASE_URL_TEST)
pnpm test:e2e      # Playwright (starts the app; needs a seeded database)
pnpm lint && pnpm typecheck
```

Integration tests refuse to run unless `DATABASE_URL_TEST` points to a local database whose name ends in `_test`, because they truncate tables.

## 2. How it is deployed

Live: https://site-visit-assistant.vercel.app. Repository: https://github.com/Arpan7125/site-visit-assistant. Every push to `main` deploys to production.

- **App:** Vercel (Next.js preset). `vercel.json` sets the build command `prisma migrate deploy && prisma generate && next build`, so migrations run on each deploy.
- **Database:** Supabase Postgres (free tier, eu-west-1). `DATABASE_URL` is the transaction pooler (port 6543, `?pgbouncer=true&connection_limit=1`) for serverless functions; `DIRECT_URL` is the session pooler (port 5432) for migrations. Any Postgres 14+ works.
- **Seed the hosted demo once:** `scripts/supabase-env.mjs` reads the git-ignored `.env.supabase` (`SUPABASE_DB_PASSWORD`, `SUPABASE_POOLER_HOST`, `SUPABASE_DB_USER`), URL-encodes the password and runs a command with both URLs set, without printing them:

```bash
node scripts/supabase-env.mjs run "pnpm exec prisma migrate deploy"
node scripts/supabase-env.mjs run --direct "pnpm db:seed -- --reset"
```

- **Reminders:** `.github/workflows/reminders.yml` calls `GET /api/cron/reminders` every 15 minutes with `Authorization: Bearer $CRON_SECRET`. Set `CRON_SECRET` as a GitHub repository secret (same value as on Vercel); the optional repository variable `APP_URL` defaults to the live URL. Vercel Hobby allows only daily crons, so `vercel.json` keeps a daily Vercel Cron as a safety net. The route rejects anything without the secret and is idempotent, so overlapping or manual calls are safe:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://site-visit-assistant.vercel.app/api/cron/reminders
```

## 3. Environment variables (names only)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection for the app |
| `DIRECT_URL` | Session connection used by migrations and seeding (same as `DATABASE_URL` locally; Supabase session pooler in production) |
| `DATABASE_URL_TEST` | Separate local Postgres database for integration tests |
| `AUTH_SECRET` | Auth.js session encryption secret |
| `APP_BASE_URL` | Public base URL of the app |
| `ANTHROPIC_API_KEY` | Claude API key; empty = assistant runs in outage/fallback mode |
| `ANTHROPIC_MODEL` | Claude model id (default `claude-opus-5-5`) |
| `ANTHROPIC_EFFORT` | Optional effort level for the model (default `low`, for chat latency) |
| `CRON_SECRET` | Bearer token required by the reminder cron route |
| `LINK_SIGNING_SECRET` | HMAC key for signed visit links and chat session cookies |
| `PHONE_HASH_SECRET` | HMAC key for hashing phone numbers (duplicate lookup) |
| `MOCK_MESSAGING` | `true`: reminders are written to the message log, never sent |

## 4. Demo logins (fictional users, demo passwords only)

| Role | Email | Password |
|---|---|---|
| Sales head | `head@companya.test` | `head-demo-2026` |
| Sales executive | `riya@companya.test` | `exec-demo-2026` |
| Other executives | `aman@`, `karan@`, `pooja@`, `imran@`, `devang@companya.test` | `exec-demo-2026` |

Change or remove these accounts before any real use.

## 5. Three-minute reviewer walkthrough

1. **Buyer, on a phone width (375 px).** Open `/`, tap *Chat with us*, choose English.
   - Tap *Book a site visit*: the picker shows only genuinely free times (seeded bookings are gaps).
   - Pick a time, give a fictional name, tick consent, enter a test number like `98250 99901`. The visit pass appears with time, address, map link, RERA number and reminder note. Open *Change or cancel* to see the signed visit page.
   - With an API key: ask "Is there parking?", then "Are pets allowed?" (not in the fact sheet → "a person will confirm" + named executive), then "Any discount?" (refusal + handoff). Type `STOP` to opt out.
2. **Double booking.** Open the same slot in a second browser (private window) and pick it after the first booking: it answers that the time was just taken and offers the nearest free times.
3. **Executive.** Sign in as `riya@companya.test`. Leads list: source tags, merged duplicates (Hardik Patel, LD-58210, came via portal and social ad), "Possible duplicate" badges, first-reply times. Open a lead with an open handoff: summary, transcript, *I've got this*, log a visit outcome. Try `/admin/dashboard`: executives are sent back.
4. **Sales head.** Sign in as `head@companya.test`. Dashboard: median first response, % not reached in 48 h, show-up rate and cost per visit by source, and the flagged-chat queue (*Mark reviewed*). Settings: edit a fact, toggle a slot (a booked one asks before cancelling), and read the message log of mock WhatsApp reminders, each with the RERA number.

## 6. Troubleshooting

- **`Can't reach database server at localhost:5432`**: Docker Desktop is not running. Start it, then `docker compose up -d --wait`.
- **Seed says "already seeded"**: run `pnpm db:seed -- --reset` (deletes demo data only in the database `DATABASE_URL` points at).
- **Every chat reply says "having trouble answering"**: `ANTHROPIC_API_KEY` is empty or invalid, or the model took longer than 8 s. Check server logs for `assistant model error`.
- **Login loops back to the sign-in page**: `AUTH_SECRET` is missing, or `APP_BASE_URL`/host differs from the URL you opened.
- **Integration tests refuse to run**: `DATABASE_URL_TEST` must be a local database ending in `_test`.
- **Visit link says expired**: links are valid until a week after the visit, and only with the exact `t=` token.
