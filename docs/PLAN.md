# Plan

Scoring: Quality 50%, Problem solving 30%, Communication 20%. A narrow slice done well beats breadth.

## Day 1 — Foundation
- [ ] CLAUDE.md, PLAN, ASSUMPTIONS, .gitignore, .env.example, first commit
- [ ] Scaffold Next.js + TS + Tailwind + Prisma + Vitest
- [ ] Prisma schema + raw-SQL partial unique index migration
- [ ] Seed script (sample leads exactly as given + fictional extras)
- [ ] Auth.js credentials + roles, design tokens

## Day 2 — Booking correctness and leads
- [ ] Failing 20-parallel booking test, then booking transaction (green)
- [ ] DB-level partial index test (bypass app logic)
- [ ] Free-slot query (future, active, unbooked)
- [ ] Lead list, E.164 normalisation, duplicate detection (exact + fuzzy), CSV import

## Day 3 — AI
- [ ] Fact sheet search tool
- [ ] Provider interface + Anthropic adapter + fake model
- [ ] Tools: search_fact_sheet, get_free_slots, book_visit, update_lead_profile, request_handoff
- [ ] Output guard (price/discount/banned claims/grounding), timeout fallback, opt-out detection
- [ ] AI behaviour tests (missing fact, price, injection, outage, language)

## Day 4 — Buyer UI
- [ ] Landing, chat, language switch, consent, slot picker, confirmation card, `.ics`
- [ ] `/visit/[id]` signed link with cancel

## Day 5 — Handoff and reminders
- [ ] Handoff assignment (weighted round-robin), AI summary + deterministic fallback
- [ ] Lead detail with transcript, editable summary, visit outcome
- [ ] Reminder outbox, cron route, mock sender, message log

## Day 6 — Head tools and polish
- [ ] Source dashboard + flagged-chat review queue
- [ ] Fact sheet editor + slot manager
- [ ] Empty/loading/error states, a11y pass, Playwright e2e

## Day 7 — Ship
- [ ] Deploy (Vercel + Neon), verify live
- [ ] TDD.md, deployment.md, AI_EVALS.md, README
- [ ] Security sweep, submission zip

## What I cut
(filled in as decisions are made)
