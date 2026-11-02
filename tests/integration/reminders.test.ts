import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookVisit, cancelVisit } from "@/lib/booking/book";
import { TEMPLATE_SEED } from "@/lib/messaging/templates";
import { sendDueReminders } from "@/lib/reminders/send";
import { DAY, HOUR, MINUTE } from "@/lib/time";
import { db, makeLead, makeProject, makeSlot, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await db.messageTemplate.createMany({ data: TEMPLATE_SEED });
});
afterAll(() => db.$disconnect());

async function booked(opts: Parameters<typeof makeLead>[0] = {}, startsIn = 3 * DAY) {
  const p = (await db.project.findUnique({ where: { id: "p1" } })) ?? (await makeProject("p1"));
  const slot = await makeSlot(p.id, new Date(Date.now() + startsIn));
  const lead = await makeLead(opts);
  const res = await bookVisit(db, { leadId: lead.id, slotId: slot.id });
  if (!res.ok) throw new Error("booking failed");
  return { lead, slot, visit: res.visit };
}

describe("reminder outbox", () => {
  it("creates T-1d and T-2h rows for a visit days away", async () => {
    const { visit, slot } = await booked();
    const rows = await db.reminderOutbox.findMany({ where: { visitId: visit.id }, orderBy: { sendAt: "asc" } });
    expect(rows.map((r) => r.kind)).toEqual(["T_MINUS_1D", "T_MINUS_2H"]);
    expect(rows[0].sendAt.getTime()).toBe(slot.startsAt.getTime() - DAY);
    expect(rows[1].sendAt.getTime()).toBe(slot.startsAt.getTime() - 2 * HOUR);
  });

  it("a booking under 2 h away gets exactly one reminder, due now", async () => {
    const { visit } = await booked({}, 90 * MINUTE);
    const rows = await db.reminderOutbox.findMany({ where: { visitId: visit.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("T_MINUS_2H");
    expect(rows[0].sendAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("sends due rows once with RERA number, in the buyer's language; cron is idempotent", async () => {
    const { visit, slot } = await booked({}, 3 * DAY);
    await db.lead.updateMany({ data: { language: "GU" } });
    const at = new Date(slot.startsAt.getTime() - DAY + MINUTE);

    const first = await sendDueReminders(db, at);
    const second = await sendDueReminders(db, at);
    expect(first.sent).toBe(1);
    expect(second.processed).toBe(0);

    const sent = await db.reminderOutbox.findFirstOrThrow({ where: { visitId: visit.id, kind: "T_MINUS_1D" } });
    expect(sent.status).toBe("SENT");
    expect(sent.body).toContain("PR/GJ/TEST/p1");
    expect(sent.body).toContain("આવતીકાલે");
    const later = await db.reminderOutbox.findFirstOrThrow({ where: { visitId: visit.id, kind: "T_MINUS_2H" } });
    expect(later.status).toBe("PENDING");
  });

  it("parallel cron runs never double-send", async () => {
    await booked({}, 3 * DAY);
    await booked({}, 3 * DAY + HOUR);
    const at = new Date(Date.now() + 3 * DAY - 30 * MINUTE); // all four due, neither visit started
    const runs = await Promise.all([sendDueReminders(db, at), sendDueReminders(db, at), sendDueReminders(db, at)]);
    expect(runs.reduce((n, r) => n + r.sent, 0)).toBe(4);
  });

  it("skips without consent and after opt-out (checked at send time)", async () => {
    const noConsent = await booked({ consent: false }, 3 * DAY);
    const optOut = await booked({}, 3 * DAY + HOUR);
    await db.lead.update({ where: { id: optOut.lead.id }, data: { optedOut: true } }); // after booking
    await sendDueReminders(db, new Date(Date.now() + 2 * DAY + 2 * HOUR));

    const statuses = async (visitId: string) =>
      (await db.reminderOutbox.findMany({ where: { visitId }, orderBy: { sendAt: "asc" } })).map((r) => r.status);
    expect(await statuses(noConsent.visit.id)).toEqual(["SKIPPED_NO_CONSENT", "PENDING"]);
    expect(await statuses(optOut.visit.id)).toEqual(["SKIPPED_OPTED_OUT", "PENDING"]);
    expect(await db.reminderOutbox.count({ where: { status: "SENT" } })).toBe(0);
  });

  it("cancelling a visit cancels its pending reminders", async () => {
    const { visit } = await booked();
    await cancelVisit(db, { visitId: visit.id, actorId: null });
    const rows = await db.reminderOutbox.findMany({ where: { visitId: visit.id } });
    expect(rows.every((r) => r.status === "CANCELLED")).toBe(true);
  });
});
