# Site-visit assistant

Every property enquiry answered in seconds, in English, हिन्दी or ગુજરાતી, and turned into a site visit at a time that is actually free.

Built for a hiring brief: "Company A", an Ahmedabad developer with two projects, pays about ₹1,000 per lead and loses a third of them to a 14-hour first response. This app:

- **answers every chat instantly** and answers only from the sales head's fact sheet; if a fact is missing it says a person will confirm and hands off;
- **books site visits only into genuinely free slots**, with no double booking (row lock plus a partial unique index, both tested with a 20-way race);
- sends **reminders a day and 2 hours before** (mock WhatsApp, approved templates, RERA number, consent re-checked at send time);
- hands **serious buyers to a named executive** with a summary and the full transcript;
- keeps **one lead list** across portals, ads, website, hoarding calls and WhatsApp, with phone-based duplicate detection;
- shows the sales head **response time, visits, show-up rate and cost per visit by source**, plus the daily review queue of flagged chats.

It never quotes a final price or discount: those questions go to a person, and a code-level guard blocks any reply with a price that isn't a quotable "starting from" entry.

**Live demo:** https://site-visit-assistant.vercel.app (staff logins in [deployment.md](deployment.md#4-demo-logins-fictional-users-demo-passwords-only))

## Quick start

```bash
pnpm install
cp .env.example .env      # fill in values, see deployment.md
docker compose up -d --wait
pnpm db:deploy && pnpm db:seed
pnpm dev                  # http://localhost:3000
```

Demo logins and a 3-minute walkthrough: [deployment.md](deployment.md).

## Documents

- [Technical design (TDD)](docs/TDD.md): architecture, data model, AI design, the no-double-booking approach, security, testing, limitations
- [Deployment and local setup](deployment.md)
- [AI evaluation](docs/AI_EVALS.md)
- [Assumptions](docs/ASSUMPTIONS.md) and [plan](docs/PLAN.md)

## Stack

Next.js 15 (App Router, TypeScript), PostgreSQL with Prisma, Auth.js, Claude via the Anthropic SDK (tool use), Tailwind CSS, Zod, Vitest, Playwright. Deployed on Vercel with Supabase Postgres.

All people, phone numbers, projects and RERA numbers in the demo data are fictional.
