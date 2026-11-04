import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookVisit } from "@/lib/booking/book";
import { SlotHasBooking, generateSlots, setSlotActive, topUpSlots } from "@/lib/booking/admin";
import { getFreeSlots } from "@/lib/booking/slots";
import { deleteFact, saveFact } from "@/lib/facts/admin";
import { searchFacts } from "@/lib/facts/search";
import { createHandoff } from "@/lib/handoff/create";
import { NotAllowed, eraseLeadData, recordVisitOutcome } from "@/lib/leads/actions";
import { DAY, HOUR, istDateKey, istToUtc, istWeekday } from "@/lib/time";
import { db, makeExec, makeLead, makeProject, makeSlot, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("slot manager", () => {
  it("generates slots by weekday pattern, in the future only, without duplicates", async () => {
    const p = await makeProject();
    const head = await makeExec("Head", "SALES_HEAD");
    const from = istDateKey(new Date(Date.now() + DAY));
    const pattern = { projectId: p.id, fromDate: from, days: 7, weekdays: [0, 2, 3, 4, 5, 6], startHour: 10, endHour: 17, minutes: 60 as const };
    const first = await generateSlots(db, pattern, head.id);
    const again = await generateSlots(db, pattern, head.id);

    expect(first.created).toBe(6 * 7); // 6 open days × 7 one-hour slots
    expect(again.created).toBe(0);
    const slots = await db.visitSlot.findMany();
    expect(slots.every((s) => istWeekday(s.startsAt) !== 1)).toBe(true);
    expect(slots.some((s) => s.startsAt.getTime() === istToUtc(from, 10).getTime() || istWeekday(istToUtc(from, 10)) === 1)).toBe(true);
  });

  it("refuses to disable a slot with a booking unless the cancellation is confirmed", async () => {
    const p = await makeProject();
    const head = await makeExec("Head", "SALES_HEAD");
    const slot = await makeSlot(p.id, new Date(Date.now() + 2 * DAY));
    const lead = await makeLead();
    const booked = await bookVisit(db, { leadId: lead.id, slotId: slot.id });
    if (!booked.ok) throw new Error("setup");

    await expect(setSlotActive(db, { slotId: slot.id, active: false, actorId: head.id })).rejects.toBeInstanceOf(SlotHasBooking);
    expect((await db.visitSlot.findUniqueOrThrow({ where: { id: slot.id } })).isActive).toBe(true);

    await setSlotActive(db, { slotId: slot.id, active: false, cancelBooked: true, actorId: head.id });
    expect((await db.visit.findUniqueOrThrow({ where: { id: booked.visit.id } })).status).toBe("CANCELLED");
    expect(await db.reminderOutbox.count({ where: { visitId: booked.visit.id, status: "PENDING" } })).toBe(0);
    expect(await getFreeSlots(db, { projectId: p.id, from: new Date(), to: new Date(Date.now() + 7 * DAY) })).toHaveLength(0);
  });
});

describe("rolling slot top-up (run by the reminder job)", () => {
  // A fixed Wednesday 09:00 IST, so the day count is deterministic.
  const now = istToUtc("2026-11-04", 9);

  it("opens two weeks of slots without Mondays, and a second run adds nothing", async () => {
    await makeProject("p1");
    await makeProject("p2");
    const first = await topUpSlots(db, now);
    const second = await topUpSlots(db, now);

    // 4 Nov to 18 Nov is 15 days; 2 Mondays (9 and 16 Nov) are closed: 13 days × 7 slots × 2 projects.
    expect(first.created).toBe(13 * 7 * 2);
    expect(second.created).toBe(0);
    const slots = await db.visitSlot.findMany();
    expect(slots.every((s) => istWeekday(s.startsAt) !== 1 && s.startsAt > now)).toBe(true);
    expect(await db.activityLog.count({ where: { action: "slots.topped_up" } })).toBe(2);
  });

  it("never re-enables a slot the sales head switched off, and fills days that roll into view", async () => {
    const p = await makeProject("p1");
    const head = await makeExec("Head", "SALES_HEAD");
    await topUpSlots(db, now);
    const slot = await db.visitSlot.findFirstOrThrow({ where: { projectId: p.id }, orderBy: { startsAt: "asc" } });
    await setSlotActive(db, { slotId: slot.id, active: false, actorId: head.id });

    const nextDay = await topUpSlots(db, new Date(now.getTime() + DAY));
    expect(nextDay.created).toBe(7); // Thursday 19 Nov comes into the window
    expect((await db.visitSlot.findUniqueOrThrow({ where: { id: slot.id } })).isActive).toBe(false);
  });
});

describe("fact sheet editor", () => {
  it("versions edits, logs them, and the assistant's search sees the change immediately", async () => {
    const p = await makeProject();
    const head = await makeExec("Head", "SALES_HEAD");
    const created = await saveFact(db, { projectId: p.id, key: "pet_policy", category: "amenities", valueEn: "Pets are allowed in apartments.", quotable: false }, head);
    expect(created.version).toBe(1);
    expect((await searchFacts(db, { query: "pets allowed", projectId: p.id, language: "EN" }))[0]?.id).toBe(created.id);

    const edited = await saveFact(db, { id: created.id, projectId: p.id, key: "pet_policy", category: "amenities", valueEn: "Small pets are allowed.", quotable: false }, head);
    expect(edited.version).toBe(2);
    await deleteFact(db, created.id, head.id);
    expect(await searchFacts(db, { query: "pets allowed", projectId: p.id, language: "EN" })).toHaveLength(0);
    expect(await db.activityLog.count({ where: { entityType: "FactSheetEntry" } })).toBe(3);
  });

  it("rejects bad input", async () => {
    const head = await makeExec("Head", "SALES_HEAD");
    await expect(saveFact(db, { projectId: null, key: "Bad Key!", category: "amenities", valueEn: "x", quotable: false }, head)).rejects.toThrow();
  });
});

describe("lead actions", () => {
  it("visit outcome only after the visit time, and it updates the lead", async () => {
    const p = await makeProject();
    const exec = await makeExec("Riya");
    const lead = await makeLead();
    const future = await makeSlot(p.id, new Date(Date.now() + DAY));
    const res = await bookVisit(db, { leadId: lead.id, slotId: future.id });
    if (!res.ok) throw new Error("setup");
    await expect(recordVisitOutcome(db, res.visit.id, "COMPLETED", exec.id)).rejects.toBeInstanceOf(NotAllowed);
    await recordVisitOutcome(db, res.visit.id, "NO_SHOW", exec.id, new Date(Date.now() + DAY + HOUR));
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("NO_SHOW");
  });

  it("erasing a lead removes personal data but keeps the anonymous record", async () => {
    const p = await makeProject();
    const head = await makeExec("Head", "SALES_HEAD");
    await makeExec("Riya");
    const lead = await makeLead({ name: "Erase Me" });
    const session = await db.chatSession.create({ data: { leadId: lead.id, messages: { create: [{ role: "BUYER", content: "my number is 98250 00000" }] } } });
    await createHandoff(db, { leadId: lead.id, sessionId: session.id, reason: "HUMAN_REQUESTED" });
    const slot = await makeSlot(p.id, new Date(Date.now() + 2 * DAY));
    await bookVisit(db, { leadId: lead.id, slotId: slot.id });

    await eraseLeadData(db, lead.id, head.id);
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after).toMatchObject({ name: "Deleted on request", phoneE164: null, phoneHash: null, optedOut: true });
    expect(after.deletedAt).not.toBeNull();
    expect((await db.chatMessage.findFirstOrThrow({ where: { sessionId: session.id } })).content).toBe("[removed on request]");
    expect(await db.visit.count({ where: { leadId: lead.id, status: "BOOKED" } })).toBe(0);
    expect(await db.activityLog.count({ where: { action: "lead.erased", entityId: lead.id } })).toBe(1);
  });
});
