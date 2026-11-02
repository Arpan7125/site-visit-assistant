/* eslint-disable no-console */
import { PrismaClient, type Language, type LeadSource, type VisitStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { bookVisit } from "../src/lib/booking/book";
import { createHandoff } from "../src/lib/handoff/create";
import { createLead, resolvePossibleDuplicate } from "../src/lib/leads/create";
import { importLeadsCsv } from "../src/lib/leads/csv";
import { TEMPLATE_SEED } from "../src/lib/messaging/templates";
import { planReminders } from "../src/lib/reminders/schedule";
import { sendDueReminders } from "../src/lib/reminders/send";
import { DAY, HOUR, MINUTE, istDateKey, istToUtc, istWeekday } from "../src/lib/time";
import { FACTS } from "./seed-data/facts";

config({ quiet: true });
const db = new PrismaClient();
const now = new Date();

// Deterministic pseudo-random so every seed run looks the same relative to "now".
let rnd = 42;
const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);


export const DEMO_PASSWORDS = { head: "head-demo-2026", exec: "exec-demo-2026" };

const PROJECTS = [
  {
    id: "aranya",
    name: "Aranya Heights",
    reraNumber: "PR/GJ/AHMEDABAD/DEMO/RAA00001/2026",
    address: "Aranya Heights, off Shela–Bopal Road, Shela, Ahmedabad 380058",
    locality: "Shela",
    lat: 23.0012,
    lng: 72.4545,
    tagline: "2 and 3 BHK homes around a quiet green court, off Shela–Bopal Road.",
  },
  {
    id: "vasant",
    name: "Vasant Residency",
    reraNumber: "PR/GJ/AHMEDABAD/DEMO/RAA00002/2026",
    address: "Vasant Residency, near Vande Mataram Circle, Gota, Ahmedabad 382481",
    locality: "Gota",
    lat: 23.1006,
    lng: 72.545,
    tagline: "2 and 3 BHK homes a short drive from SG Highway.",
  },
].map((p) => ({ ...p, mapUrl: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` }));

const STAFF = [
  { name: "Neha Kothari", email: "head@companya.test", role: "SALES_HEAD" as const },
  { name: "Riya Desai", email: "riya@companya.test", role: "EXECUTIVE" as const },
  { name: "Aman Trivedi", email: "aman@companya.test", role: "EXECUTIVE" as const },
  { name: "Karan Shah", email: "karan@companya.test", role: "EXECUTIVE" as const },
  { name: "Pooja Mehta", email: "pooja@companya.test", role: "EXECUTIVE" as const },
  { name: "Imran Sheikh", email: "imran@companya.test", role: "EXECUTIVE" as const },
  { name: "Devang Parmar", email: "devang@companya.test", role: "EXECUTIVE" as const },
];

/** Typical first-response delay by source, before/after the assistant (minutes). */
const RESPONSE_MIN: Record<LeadSource, () => number | null> = {
  WEBSITE: () => 0.02,
  WHATSAPP: () => 0.05,
  SOCIAL_AD: () => (rand() < 0.85 ? 0.05 : 9 * 60 + rand() * 300),
  PORTAL: () => (rand() < 0.75 ? 0.08 : rand() < 0.5 ? 14 * 60 : null),
  HOARDING_CALL: () => (rand() < 0.6 ? 3 + rand() * 20 : rand() < 0.7 ? 16 * 60 : null),
};

async function main() {
  const reset = process.argv.includes("--reset");
  if ((await db.user.count()) > 0 && !reset) {
    console.log("Database already seeded. Run `pnpm db:seed -- --reset` to wipe demo data and seed again.");
    return;
  }
  if (reset) {
    console.log("Resetting demo data…");
    await db.$executeRawUnsafe(`
      TRUNCATE "ActivityLog","ReminderOutbox","Handoff","Visit","VisitSlot","ChatMessage",
        "ChatSession","Lead","FactSheetEntry","MessageTemplate","Project","User" CASCADE`);
    await db.$executeRawUnsafe(`ALTER SEQUENCE "lead_number_seq" RESTART WITH 58300`);
  }

  await db.project.createMany({ data: PROJECTS });
  await db.messageTemplate.createMany({ data: TEMPLATE_SEED });
  const hashes = {
    head: await bcrypt.hash(DEMO_PASSWORDS.head, 10),
    exec: await bcrypt.hash(DEMO_PASSWORDS.exec, 10),
  };
  for (const s of STAFF) {
    await db.user.create({ data: { ...s, passwordHash: s.role === "SALES_HEAD" ? hashes.head : hashes.exec } });
  }
  const head = await db.user.findUniqueOrThrow({ where: { email: "head@companya.test" } });
  const execs = await db.user.findMany({ where: { role: "EXECUTIVE" }, orderBy: { name: "asc" } });
  for (const f of FACTS) await db.factSheetEntry.create({ data: { ...f, quotable: f.quotable ?? false, updatedBy: head.name } });

  // ---- Visit slots: Tue–Sun, 10:00–17:00 IST, next 14 days (Assumption A4) ----
  const slotIds: Record<string, string[]> = { aranya: [], vasant: [] };
  for (let d = 0; d <= 14; d++) {
    const date = istDateKey(new Date(now.getTime() + d * DAY));
    if (istWeekday(istToUtc(date, 12)) === 1) continue; // Monday closed
    for (const p of PROJECTS) {
      for (let h = 10; h < 17; h++) {
        const startsAt = istToUtc(date, h);
        const slot = await db.visitSlot.create({ data: { projectId: p.id, startsAt, endsAt: new Date(startsAt.getTime() + HOUR) } });
        if (startsAt > now) slotIds[p.id].push(slot.id);
      }
    }
  }

  // ---- The three sample leads from the brief, exactly as given ----
  const sample = [
    { id: "LD-58210", name: "Hardik Patel", source: "PORTAL", projectId: "aranya", wantsBhk: 3, phone: "9825012101", daysAgo: 6 },
    { id: "LD-58211", name: "Nidhi Shah", source: "SOCIAL_AD", projectId: "vasant", wantsBhk: 2, phone: "9825012102", daysAgo: 3 },
    { id: "LD-58224", name: "Kavita Joshi", source: "HOARDING_CALL", projectId: "vasant", wantsBhk: 2, phone: "9825012103", daysAgo: 12 },
  ] as const;
  for (const s of sample) {
    const createdAt = new Date(now.getTime() - s.daysAgo * DAY);
    await createLead(db, { id: s.id, name: s.name, phone: s.phone, source: s.source, projectId: s.projectId, wantsBhk: s.wantsBhk, consentContact: true, createdAt }, { actorId: null });
  }
  // LD-58210: booked for 2026-11-01 11:00 IST (now in the past) → recorded as visited (Assumption A7).
  await pastVisit("LD-58210", "aranya", "2026-11-01", 11, "COMPLETED", execs[0].id);
  await db.lead.update({ where: { id: "LD-58210" }, data: { status: "VISITED", budgetMinLakh: 100, budgetMaxLakh: 120, assignedExecId: execs[0].id, firstResponseAt: new Date(now.getTime() - 6 * DAY + 4 * MINUTE) } });
  await db.lead.update({ where: { id: "LD-58211" }, data: { status: "ENGAGED", budgetMinLakh: 60, budgetMaxLakh: 70, firstResponseAt: new Date(now.getTime() - 3 * DAY + 3 * 1000) } });
  const kavitaVisitDay = istDateKey(new Date(now.getTime() - 9 * DAY));
  await pastVisit("LD-58224", "vasant", kavitaVisitDay, 15, "COMPLETED", execs[1].id);
  await db.lead.update({ where: { id: "LD-58224" }, data: { status: "VISITED", assignedExecId: execs[1].id, firstResponseAt: new Date(now.getTime() - 12 * DAY + 18 * MINUTE) } });

  // ---- Portal export imported through the CSV path (same validation and dedupe as the UI) ----
  const portalRows = [
    ["Rohan Mehta", "9824023401", "aranya", 3, 95, 115, 21],
    ["Sneha Bhatt", "9824023402", "vasant", 2, 62, 70, 17],
    ["Vivek Rana", "9824023403", "aranya", 2, 78, 85, 9],
    ["Ishita Pandya", "9824023404", "vasant", 3, 85, 95, 5],
    ["Mehul Chauhan", "9824023405", "aranya", 3, 100, 120, 2],
    ["Anjali Rao", "9824023406", "vasant", 2, 60, 68, 30],
    ["Bhavesh Solanki", "9824023407", "aranya", 2, 80, 88, 40],
  ] as const;
  const csv = [
    "name,phone,source,project,bhk,budget_min_lakh,budget_max_lakh,created_at",
    ...portalRows.map(([n, p, proj, bhk, mn, mx, ago]) =>
      [n, p, "Property portal", proj, bhk, mn, mx, new Date(now.getTime() - ago * DAY - 3 * HOUR).toISOString()].join(","),
    ),
  ].join("\n");
  const imported = await importLeadsCsv(db, csv, { actorId: head.id, projectIds: { aranya: "aranya", vasant: "vasant" } });
  console.log(`CSV import: ${imported.created} created, ${imported.errors.length} errors`);

  // ---- More leads across all sources ----
  const others: { name: string; phone?: string; source: LeadSource; project?: string; bhk?: number; ago: number; lang?: Language; consent?: boolean }[] = [
    { name: "Parth Vyas", phone: "9909034501", source: "WEBSITE", project: "aranya", bhk: 3, ago: 1, consent: true },
    { name: "Dhara Thakkar", phone: "9909034502", source: "WEBSITE", project: "vasant", bhk: 2, ago: 4, lang: "GU", consent: true },
    { name: "Sanjay Gupta", phone: "9909034503", source: "SOCIAL_AD", project: "aranya", bhk: 3, ago: 7, lang: "HI", consent: true },
    { name: "Krupa Dave", phone: "9909034504", source: "SOCIAL_AD", project: "vasant", bhk: 2, ago: 10, consent: true },
    { name: "Arjun Nair", phone: "9909034505", source: "SOCIAL_AD", project: "aranya", bhk: 2, ago: 14, consent: true },
    { name: "Hetal Prajapati", phone: "9909034506", source: "HOARDING_CALL", project: "vasant", bhk: 2, ago: 8, lang: "GU", consent: true },
    { name: "Manoj Yadav", phone: "9909034507", source: "HOARDING_CALL", project: "aranya", bhk: 3, ago: 19, lang: "HI", consent: true },
    { name: "Foram Jani", phone: "9909034508", source: "WHATSAPP", project: "vasant", bhk: 3, ago: 2, lang: "GU", consent: true },
    { name: "Rahul Kapoor", phone: "9909034509", source: "WHATSAPP", project: "aranya", bhk: 3, ago: 11, consent: true },
    { name: "Priyanka Sinha", phone: "9909034510", source: "WEBSITE", project: "aranya", bhk: 2, ago: 15, consent: true },
    { name: "Yash Modi", phone: "9909034511", source: "PORTAL", project: "vasant", bhk: 3, ago: 26, consent: true },
    { name: "Tejal Raval", phone: "9909034512", source: "SOCIAL_AD", project: "vasant", bhk: 2, ago: 33, consent: true },
    { name: "Nikhil Agarwal", phone: "9909034513", source: "HOARDING_CALL", project: "aranya", bhk: 3, ago: 36, consent: false },
    { name: "Web visitor", source: "WEBSITE", project: "vasant", ago: 0.2 },
    { name: "Ketan Barot", phone: "9909034514", source: "WEBSITE", project: "vasant", bhk: 2, ago: 6, consent: true },
    { name: "Shruti Iyer", phone: "9909034515", source: "SOCIAL_AD", project: "aranya", bhk: 3, ago: 0.5, consent: true },
    // Duplicate pairs: same phone, different source (auto-linked, source tags merged).
    { name: "Hardik Patel", phone: "+91 98250 12101", source: "SOCIAL_AD", project: "aranya", bhk: 3, ago: 4, consent: true },
    { name: "Rohan M.", phone: "09824023401", source: "WEBSITE", project: "aranya", bhk: 3, ago: 12, consent: true },
    { name: "Foram J", phone: "+91-9909034508", source: "HOARDING_CALL", project: "vasant", ago: 1, consent: true },
    // Fuzzy near-duplicate: similar name, same project, different number → "possible duplicate".
    { name: "Nidhi Shaah", phone: "9909034520", source: "HOARDING_CALL", project: "vasant", bhk: 2, ago: 1.5, consent: true },
    { name: "Sneha Bhat", phone: "9909034521", source: "WHATSAPP", project: "vasant", bhk: 2, ago: 3, consent: true },
  ];
  const created: Record<string, string> = {};
  for (const o of others) {
    const createdAt = new Date(now.getTime() - o.ago * DAY);
    const r = await createLead(
      db,
      { name: o.name, phone: o.phone, source: o.source, projectId: o.project, wantsBhk: o.bhk, language: o.lang, consentContact: o.consent, createdAt },
      { actorId: null },
    );
    created[o.name] = r.lead.id;
  }
  // The head already reviewed one fuzzy match and kept it separate.
  await resolvePossibleDuplicate(db, { leadId: created["Sneha Bhat"], action: "dismiss", actorId: head.id });

  // First response times by source (the dashboard's headline metric).
  const leads = await db.lead.findMany({ where: { firstResponseAt: null } });
  for (const l of leads) {
    const delay = RESPONSE_MIN[l.source]();
    if (delay != null) await db.lead.update({ where: { id: l.id }, data: { firstResponseAt: new Date(l.firstContactAt.getTime() + delay * MINUTE) } });
  }
  // Assign executives to older leads; mark a few as lost.
  const all = await db.lead.findMany({ where: { duplicateOfId: null, assignedExecId: null }, orderBy: { createdAt: "asc" } });
  for (const [i, l] of all.entries()) {
    if (l.name === "Web visitor") continue;
    await db.lead.update({
      where: { id: l.id },
      data: { assignedExecId: execs[i % execs.length].id, status: l.firstResponseAt ? "ENGAGED" : "NEW", budgetMinLakh: l.budgetMinLakh ?? (l.wantsBhk === 3 ? 90 : 62), budgetMaxLakh: l.budgetMaxLakh ?? (l.wantsBhk === 3 ? 115 : 75) },
    });
  }
  for (const name of ["Anjali Rao", "Tejal Raval"]) {
    const l = await db.lead.findFirst({ where: { name } });
    if (l) await db.lead.update({ where: { id: l.id }, data: { status: "LOST", notes: "Bought elsewhere (told on call)." } });
  }

  // ---- Past visits (show-up rate) ----
  const pastOutcomes: [string, "aranya" | "vasant", number, number, VisitStatus][] = [
    ["Rohan Mehta", "aranya", 16, 11, "COMPLETED"],
    ["Sneha Bhatt", "vasant", 14, 12, "NO_SHOW"],
    ["Sanjay Gupta", "aranya", 5, 16, "COMPLETED"],
    ["Krupa Dave", "vasant", 8, 10, "COMPLETED"],
    ["Manoj Yadav", "aranya", 15, 14, "NO_SHOW"],
    ["Rahul Kapoor", "aranya", 9, 11, "COMPLETED"],
    ["Yash Modi", "vasant", 22, 13, "COMPLETED"],
    ["Hetal Prajapati", "vasant", 6, 15, "NO_SHOW"],
    ["Priyanka Sinha", "aranya", 12, 10, "COMPLETED"],
  ];
  for (const [name, proj, daysAgo, hour, status] of pastOutcomes) {
    const lead = await db.lead.findFirstOrThrow({ where: { name, duplicateOfId: null } });
    await pastVisit(lead.id, proj, istDateKey(new Date(now.getTime() - daysAgo * DAY)), hour, status, lead.assignedExecId);
    await db.lead.update({ where: { id: lead.id }, data: { status: status === "COMPLETED" ? "VISITED" : "NO_SHOW" } });
  }

  // ---- Upcoming visits booked through the real booking path (creates reminders) ----
  const upcoming: [string, "aranya" | "vasant", number][] = [
    ["Parth Vyas", "aranya", 0],
    ["Dhara Thakkar", "vasant", 2],
    ["Ishita Pandya", "vasant", 5],
    ["Mehul Chauhan", "aranya", 3],
    ["Foram Jani", "vasant", 1],
    ["Ketan Barot", "vasant", 9],
    ["Shruti Iyer", "aranya", 11],
  ];
  for (const [name, proj, idx] of upcoming) {
    const lead = await db.lead.findFirstOrThrow({ where: { name, duplicateOfId: null } });
    const res = await bookVisit(db, { leadId: lead.id, slotId: slotIds[proj][idx], now });
    if (!res.ok) throw new Error(`Seed booking failed for ${name}: ${res.code}`);
    await db.visit.update({ where: { id: res.visit.id }, data: { executiveId: lead.assignedExecId } });
  }

  // ---- Chats: one booked, one flagged missing-fact, one flagged discount, one Gujarati ----
  await chat(created["Parth Vyas"], "EN", false, null, [
    ["BUYER", "Hi, I'm looking at 3 BHK in Aranya Heights. How big are they?"],
    ["ASSISTANT", "The 3 BHK homes at Aranya Heights have a carpet area of 1,140 to 1,210 sq ft (RERA carpet). Are you planning to buy in the next few months?"],
    ["BUYER", "Yes, within 3 months. Budget around 1 to 1.15 crore."],
    ["ASSISTANT", "Thank you. Would you like to see the sample flat? I can book a site visit at a free time."],
    ["BUYER", "Yes please, tomorrow morning if possible"],
    ["ASSISTANT", "You're booked. You'll find the address, map and RERA number on the confirmation card."],
  ]);
  const flaggedLead = created["Ketan Barot"];
  await chat(flaggedLead, "EN", true, "MISSING_FACT", [
    ["BUYER", "Are pets allowed in Vasant Residency? I have a dog."],
    ["ASSISTANT", "I don't have that detail in our project fact sheet, so I won't guess. A member of our team will confirm it for you."],
  ]);
  await chat(created["Sanjay Gupta"], "HI", true, "DISCOUNT_ASK", [
    ["BUYER", "अगर मैं इस महीने बुक करूँ तो कितनी छूट मिलेगी?"],
    ["ASSISTANT", "मैं छूट या अंतिम कीमत पर बात नहीं कर सकती। इसकी पुष्टि केवल हमारी सेल्स टीम करती है, और मैंने उनसे आपसे संपर्क करने को कहा है।"],
  ]);
  await chat(created["Dhara Thakkar"], "GU", false, null, [
    ["BUYER", "વસંત રેસિડેન્સીમાં પાર્કિંગ છે?"],
    ["ASSISTANT", "હા, દરેક એપાર્ટમેન્ટ માટે એક કવર્ડ કાર પાર્કિંગ છે, સાથે વિઝિટર પાર્કિંગ પણ છે. શું આપ સાઇટ વિઝિટ બુક કરવા ઇચ્છો છો?"],
  ]);

  // ---- Handoffs: some open, some acknowledged ----
  for (const [name, reason] of [
    ["Parth Vyas", "SERIOUS_BUYER"],
    ["Ketan Barot", "MISSING_FACT"],
    ["Sanjay Gupta", "DISCOUNT_ASK"],
    ["Mehul Chauhan", "SERIOUS_BUYER"],
    ["Rohan Mehta", "HUMAN_REQUESTED"],
  ] as const) {
    const lead = await db.lead.findFirstOrThrow({ where: { name, duplicateOfId: null }, include: { sessions: true } });
    const h = await createHandoff(db, { leadId: lead.id, sessionId: lead.sessions[0]?.id ?? null, reason, now });
    if (name === "Rohan Mehta") await db.handoff.update({ where: { id: h.handoff.id }, data: { acknowledgedAt: new Date(now.getTime() - 15 * DAY) } });
  }

  // ---- Message log: deliver anything already due ----
  const sent = await sendDueReminders(db, now);
  console.log(`Reminders delivered by mock sender: ${sent.sent}, skipped: ${sent.skipped}`);

  const counts = await Promise.all([db.lead.count(), db.visit.count(), db.factSheetEntry.count(), db.visitSlot.count()]);
  console.log(`Seeded ${counts[0]} leads, ${counts[1]} visits, ${counts[2]} facts, ${counts[3]} slots.`);
}

async function pastVisit(leadId: string, projectId: string, date: string, hour: number, status: VisitStatus, executiveId: string | null) {
  const startsAt = istToUtc(date, hour);
  const slot = await db.visitSlot.upsert({
    where: { projectId_startsAt: { projectId, startsAt } },
    create: { projectId, startsAt, endsAt: new Date(startsAt.getTime() + HOUR) },
    update: {},
  });
  const bookedAt = new Date(startsAt.getTime() - 2 * DAY);
  const visit = await db.visit.create({ data: { leadId, slotId: slot.id, executiveId, status: "BOOKED", createdAt: bookedAt } });
  // Replay history through the real reminder path so the message log shows what was sent.
  await db.reminderOutbox.createMany({
    data: planReminders(startsAt, bookedAt).map((r) => ({
      visitId: visit.id,
      kind: r.kind,
      channel: "MOCK_WHATSAPP" as const,
      templateId: r.kind === "T_MINUS_1D" ? "visit_reminder_1d" : "visit_reminder_2h",
      payload: { slotStartsAt: startsAt.toISOString(), projectId },
      sendAt: r.sendAt,
    })),
  });
  await sendDueReminders(db, new Date(startsAt.getTime() - MINUTE));
  await db.visit.update({ where: { id: visit.id }, data: { status, outcomeAt: new Date(startsAt.getTime() + HOUR) } });
}

async function chat(leadId: string, language: Language, flagged: boolean, flagReason: string | null, lines: [("BUYER" | "ASSISTANT"), string][]) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const start = new Date(Math.max(lead.createdAt.getTime(), now.getTime() - 2 * DAY));
  await db.chatSession.create({
    data: {
      leadId,
      language,
      flagged,
      flagReason,
      startedAt: start,
      messages: {
        create: lines.map(([role, content], i) => ({
          role,
          content,
          language,
          createdAt: new Date(start.getTime() + i * 40_000 + (role === "ASSISTANT" ? 2_000 : 0)),
          guardVerdict: role === "ASSISTANT" ? JSON.stringify({ verdict: flagReason ?? "PASS", violations: [] }) : null,
        })),
      },
    },
  });
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });


