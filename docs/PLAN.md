# Plan

Scoring: Quality 50%, Problem solving 30%, Communication 20%. A narrow slice done well beats breadth.

## Day 1 — Foundation
- [x] CLAUDE.md, PLAN, ASSUMPTIONS, .gitignore, .env.example, first commit
- [x] Scaffold Next.js + TS + Tailwind + Prisma + Vitest
- [x] Prisma schema + raw-SQL partial unique index migration
- [x] Seed script (sample leads exactly as given + fictional extras)
- [x] Auth.js credentials + roles, design tokens

## Day 2 — Booking correctness and leads
- [x] Failing 20-parallel booking test, then booking transaction (green)
- [x] DB-level partial index test (bypass app logic)
- [x] Free-slot query (future, active, unbooked)
- [x] Lead list, E.164 normalisation, duplicate detection (exact + fuzzy), CSV import

## Day 3 — AI
- [x] Fact sheet search tool
- [x] Provider interface + Anthropic adapter + fake model
- [x] Tools: search_fact_sheet, get_free_slots, book_visit, update_lead_profile, request_handoff
- [x] Output guard (price/discount/banned claims/grounding), timeout fallback, opt-out detection
- [x] AI behaviour tests (missing fact, price, injection, outage, language)

## Day 4 — Buyer UI
- [x] Landing, chat, language switch, consent, slot picker, confirmation card, `.ics`
- [x] `/visit/[id]` signed link with cancel

## Day 5 — Handoff and reminders
- [x] Handoff assignment (weighted round-robin), AI summary + deterministic fallback
- [x] Lead detail with transcript, editable summary, visit outcome
- [x] Reminder outbox, cron route, mock sender, message log

## Day 6 — Head tools and polish
- [x] Source dashboard + flagged-chat review queue
- [x] Fact sheet editor + slot manager
- [ ] Empty/loading/error states, a11y pass, Playwright e2e

## Day 7 — Ship
- [ ] Deploy (Vercel + Neon), verify live
- [x] TDD.md, deployment.md, AI_EVALS.md, README
- [ ] Security sweep, submission zip

## What I cut
- WhatsApp channel (web chat only; templates and outbox are ready)
- shadcn/ui (a few hand-written primitives were enough)
- AI-written handoff summary (deterministic field summary used everywhere)
- Visit-page chrome in HI/GU (the visit pass itself is localised)
