import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookVisit, cancelVisit } from "@/lib/booking/book";
import { getFreeSlots } from "@/lib/booking/slots";
import { DAY, HOUR } from "@/lib/time";
import { db, makeLead, makeProject, makeSlot, resetDb } from "./helpers";

const now = () => new Date();

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("bookVisit: no double booking", () => {
  it("20 parallel bookings of one slot → exactly 1 success, 19 SLOT_TAKEN", async () => {
    const p = await makeProject();
    const slot = await makeSlot(p.id, new Date(Date.now() + 3 * DAY));
    await makeSlot(p.id, new Date(Date.now() + 3 * DAY + HOUR)); // an alternative to offer
    const leads = await Promise.all(Array.from({ length: 20 }, () => makeLead({ projectId: p.id })));

    const results = await Promise.all(leads.map((l) => bookVisit(db, { leadId: l.id, slotId: slot.id })));

    const ok = results.filter((r) => r.ok);
    const taken = results.filter((r) => !r.ok && r.code === "SLOT_TAKEN");
    expect(ok).toHaveLength(1);
    expect(taken).toHaveLength(19);
    for (const r of taken) {
      if (!r.ok) expect(r.alternatives.map((s) => s.id)).not.toContain(slot.id);
    }
    expect(await db.visit.count({ where: { slotId: slot.id, status: "BOOKED" } })).toBe(1);
  });

  it("the row lock alone prevents double booking (index temporarily dropped)", async () => {
    const p = await makeProject();
    const slot = await makeSlot(p.id, new Date(Date.now() + 3 * DAY));
    const leads = await Promise.all(Array.from({ length: 20 }, () => makeLead()));
    await db.$executeRawUnsafe(`DROP INDEX "visit_one_booked_per_slot"`);
    try {
      const results = await Promise.all(leads.map((l) => bookVisit(db, { leadId: l.id, slotId: slot.id })));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await db.visit.count({ where: { slotId: slot.id, status: "BOOKED" } })).toBe(1);
    } finally {
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "visit_one_booked_per_slot" ON "Visit" ("slotId") WHERE "status" = 'BOOKED'`,
      );
    }
  });

  it("the partial unique index rejects a second BOOKED visit even when app logic is bypassed", async () => {
    const p = await makeProject();
    const slot = await makeSlot(p.id, new Date(Date.now() + 2 * DAY));
    const [a, b] = [await makeLead(), await makeLead()];
    await db.visit.create({ data: { leadId: a.id, slotId: slot.id, status: "BOOKED" } });

    await expect(db.visit.create({ data: { leadId: b.id, slotId: slot.id, status: "BOOKED" } })).rejects.toMatchObject({
      code: "P2002",
    });
    // Non-BOOKED rows for the same slot are allowed (history is kept).
    await db.visit.create({ data: { leadId: b.id, slotId: slot.id, status: "CANCELLED" } });
  });

  it("a cancelled slot becomes bookable again", async () => {
    const p = await makeProject();
    const slot = await makeSlot(p.id, new Date(Date.now() + 2 * DAY));
    const [a, b] = [await makeLead(), await makeLead()];

    const first = await bookVisit(db, { leadId: a.id, slotId: slot.id });
    expect(first.ok).toBe(true);
    expect((await bookVisit(db, { leadId: b.id, slotId: slot.id })).ok).toBe(false);

    if (first.ok) await cancelVisit(db, { visitId: first.visit.id, actorId: null });
    expect((await getFreeSlots(db, { projectId: p.id, from: now(), to: new Date(Date.now() + 7 * DAY) })).map((s) => s.id)).toContain(slot.id);
    expect((await bookVisit(db, { leadId: b.id, slotId: slot.id })).ok).toBe(true);
  });

  it("rejects past and inactive slots", async () => {
    const p = await makeProject();
    const past = await makeSlot(p.id, new Date(Date.now() - HOUR));
    const inactive = await makeSlot(p.id, new Date(Date.now() + DAY), { isActive: false });
    const lead = await makeLead();

    expect(await bookVisit(db, { leadId: lead.id, slotId: past.id })).toMatchObject({ ok: false, code: "SLOT_UNAVAILABLE" });
    expect(await bookVisit(db, { leadId: lead.id, slotId: inactive.id })).toMatchObject({ ok: false, code: "SLOT_UNAVAILABLE" });
  });

  it("one active booking per lead: a second booking reschedules (old visit cancelled, its slot freed)", async () => {
    const p = await makeProject();
    const s1 = await makeSlot(p.id, new Date(Date.now() + 2 * DAY));
    const s2 = await makeSlot(p.id, new Date(Date.now() + 3 * DAY));
    const lead = await makeLead();

    const a = await bookVisit(db, { leadId: lead.id, slotId: s1.id });
    const b = await bookVisit(db, { leadId: lead.id, slotId: s2.id });
    expect(a.ok && b.ok).toBe(true);
    const visits = await db.visit.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } });
    expect(visits.map((v) => v.status)).toEqual(["CANCELLED", "BOOKED"]);
    const free = await getFreeSlots(db, { projectId: p.id, from: now(), to: new Date(Date.now() + 7 * DAY) });
    expect(free.map((s) => s.id)).toContain(s1.id);
  });
});

describe("getFreeSlots", () => {
  it("never returns past, inactive or booked slots, and orders by time", async () => {
    const p = await makeProject();
    const other = await makeProject("p2");
    await makeSlot(p.id, new Date(Date.now() - 2 * HOUR)); // past
    await makeSlot(p.id, new Date(Date.now() + DAY), { isActive: false }); // inactive
    const booked = await makeSlot(p.id, new Date(Date.now() + 2 * DAY));
    const late = await makeSlot(p.id, new Date(Date.now() + 4 * DAY));
    const early = await makeSlot(p.id, new Date(Date.now() + 3 * DAY));
    await makeSlot(other.id, new Date(Date.now() + 3 * DAY)); // other project
    await makeSlot(p.id, new Date(Date.now() + 20 * DAY)); // outside window
    const lead = await makeLead();
    await db.visit.create({ data: { leadId: lead.id, slotId: booked.id } });

    const free = await getFreeSlots(db, { projectId: p.id, from: now(), to: new Date(Date.now() + 7 * DAY) });
    expect(free.map((s) => s.id)).toEqual([early.id, late.id]);
  });
});
