# CLAUDE.md

Real estate AI lead-response and site-visit booking assistant for "Company A" (Ahmedabad).
Hiring-assessment build: quality over scope. Source of truth for requirements: the client brief
(summarised in `docs/TDD.md` §1). Anything invented goes in `docs/ASSUMPTIONS.md`.

## Stack
- Next.js (App Router) + TypeScript, route handlers and server actions as backend
- PostgreSQL via Prisma: Docker Compose or `pnpm db:local` (embedded Postgres) locally, Supabase in production (pooled `DATABASE_URL` + `DIRECT_URL`)
- Auth.js (NextAuth v5) credentials for staff: roles `EXECUTIVE`, `SALES_HEAD`
- Buyers: anonymous chat session (signed cookie) + phone captured with consent
- AI: LLM with tool use behind the `ModelProvider` interface in `src/lib/ai/`: Gemini (`gemini.ts`, live) or Claude (`provider.ts`), chosen by `AI_PROVIDER`; scripted fake model in tests
- Tailwind CSS v4 with design tokens in `src/app/globals.css`; small hand-rolled UI primitives in `src/components/ui`
- Zod on every input; Vitest (unit + integration against real Postgres); Playwright e2e

## Commands
```bash
pnpm install
docker compose up -d          # Postgres on 5432 (app db + test db)
pnpm db:migrate               # prisma migrate dev
pnpm db:seed                  # seed demo data
pnpm dev                      # http://localhost:3000
pnpm test                     # unit tests (no db)
pnpm test:int                 # integration tests (needs docker db, uses DATABASE_URL_TEST)
pnpm test:e2e                 # Playwright
pnpm lint && pnpm typecheck
```

## Conventions
- Store UTC, display `Asia/Kolkata` (use `src/lib/time.ts`).
- Domain logic lives in `src/lib/<domain>/` as plain functions taking a Prisma client (or tx) so it is testable.
- Route handlers: parse with Zod `.strict()`, authorise server-side (`requireRole`), call domain function, return JSON.
- Booking correctness: DB partial unique index + `SELECT ... FOR UPDATE` in a transaction. Never remove either.
- AI output always passes `src/lib/ai/guard.ts` before reaching the buyer.
- Commits: Conventional Commits, small and frequent. Never rewrite history.
- No secrets in the repo. No real personal data; all people are fictional.
