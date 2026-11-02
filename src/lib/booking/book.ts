import { Prisma, type PrismaClient, type Visit } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import type { Db } from "@/lib/db";
import { planReminders } from "@/lib/reminders/schedule";
import { DAY } from "@/lib/time";
import { getFreeSlots, type FreeSlot } from "./slots";

export type BookFailure = "SLOT_TAKEN" | "SLOT_UNAVAILABLE" | "LEAD_NOT_FOUND";

export type BookResult =
  | { ok: true; visit: Visit; slot: FreeSlot; rescheduledFrom: string[] }
  | { ok: false; code: BookFailure; alternatives: FreeSlot[] };

type LockedSlot = { id: string; projectId: string; startsAt: Date; endsAt: Date; isActive: boolean };

class Abort extends Error {
  constructor(readonly code: BookFailure, readonly projectId: string | null, readonly near: Date | null) {
    super(code);
  }
}

/**
 * Book a site visit. Two layers stop double booking:
 *  1. The slot row is locked with SELECT ... FOR UPDATE, so concurrent bookers of the same
 *     slot queue up and each sees the previous one's committed visit.
 *  2. The partial unique index "visit_one_booked_per_slot" rejects a second BOOKED row
 *     even if this code is bypassed or changed.
 * A lead holds at most one BOOKED visit: booking again reschedules (the old one is cancelled).
 */
export async function bookVisit(
  db: PrismaClient,
  args: { leadId: string; slotId: string; actorId?: string | null; now?: Date },
): Promise<BookResult> {
  const now = args.now ?? new Date();
  try {
    const result = await db.$transaction(
      async (tx) => {
        const [slot] = await tx.$queryRaw<LockedSlot[]>`
          SELECT "id", "projectId", "startsAt", "endsAt", "isActive"
          FROM "VisitSlot" WHERE "id" = ${args.slotId} FOR UPDATE`;
        if (!slot) throw new Abort("SLOT_UNAVAILABLE", null, null);
        if (!slot.isActive || slot.startsAt <= now) throw new Abort("SLOT_UNAVAILABLE", slot.projectId, slot.startsAt);

        const taken = await tx.visit.findFirst({ where: { slotId: slot.id, status: "BOOKED" }, select: { id: true } });
        if (taken) throw new Abort("SLOT_TAKEN", slot.projectId, slot.startsAt);

        const lead = await tx.lead.findUnique({ where: { id: args.leadId } });
        if (!lead || lead.deletedAt) throw new Abort("LEAD_NOT_FOUND", slot.projectId, slot.startsAt);

        const prior = await tx.visit.findMany({ where: { leadId: lead.id, status: "BOOKED" }, select: { id: true } });
        for (const p of prior) await cancelInTx(tx, p.id, now);

        const visit = await tx.visit.create({
          data: { leadId: lead.id, slotId: slot.id, executiveId: lead.assignedExecId },
        });
        const reminders = planReminders(slot.startsAt, now);
        if (reminders.length) {
          await tx.reminderOutbox.createMany({
            data: reminders.map((r) => ({
              visitId: visit.id,
              kind: r.kind,
              channel: "MOCK_WHATSAPP" as const,
              templateId: r.kind === "T_MINUS_1D" ? "visit_reminder_1d" : "visit_reminder_2h",
              payload: { slotStartsAt: slot.startsAt.toISOString(), projectId: slot.projectId },
              sendAt: r.sendAt,
            })),
          });
        }
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            status: lead.status === "HANDED_OFF" ? "HANDED_OFF" : "VISIT_BOOKED",
            projectId: lead.projectId ?? slot.projectId,
          },
        });
        await logActivity(tx, {
          actorId: args.actorId ?? null,
          action: prior.length ? "visit.rescheduled" : "visit.booked",
          entityType: "Visit",
          entityId: visit.id,
          meta: { leadId: lead.id, slotId: slot.id, startsAt: slot.startsAt.toISOString(), replaced: prior.map((p) => p.id) },
        });
        return {
          ok: true as const,
          visit,
          slot: { id: slot.id, projectId: slot.projectId, startsAt: slot.startsAt, endsAt: slot.endsAt },
          rescheduledFrom: prior.map((p) => p.id),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 20_000, timeout: 20_000 },
    );
    return result;
  } catch (err) {
    if (err instanceof Abort) {
      return { ok: false, code: err.code, alternatives: await alternativesNear(db, err.projectId, err.near, now) };
    }
    // Layer 2 fired: the partial unique index caught a race the lock did not.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const slot = await db.visitSlot.findUnique({ where: { id: args.slotId } });
      return {
        ok: false,
        code: "SLOT_TAKEN",
        alternatives: await alternativesNear(db, slot?.projectId ?? null, slot?.startsAt ?? null, now),
      };
    }
    throw err;
  }
}

/** Up to 3 free slots closest in time to the one the buyer wanted, in chronological order. */
async function alternativesNear(db: Db, projectId: string | null, near: Date | null, now: Date): Promise<FreeSlot[]> {
  if (!projectId) return [];
  const free = await getFreeSlots(db, { projectId, from: now, to: new Date(now.getTime() + 21 * DAY), now });
  const target = (near ?? now).getTime();
  return free
    .sort((a, b) => Math.abs(a.startsAt.getTime() - target) - Math.abs(b.startsAt.getTime() - target))
    .slice(0, 3)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

async function cancelInTx(tx: Prisma.TransactionClient, visitId: string, now: Date) {
  const res = await tx.visit.updateMany({
    where: { id: visitId, status: "BOOKED" },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  if (res.count) {
    await tx.reminderOutbox.updateMany({ where: { visitId, status: "PENDING" }, data: { status: "CANCELLED" } });
  }
  return res.count > 0;
}

export async function cancelVisit(
  db: PrismaClient,
  args: { visitId: string; actorId: string | null; reason?: string; now?: Date },
): Promise<boolean> {
  const now = args.now ?? new Date();
  return db.$transaction(async (tx) => {
    const visit = await tx.visit.findUnique({ where: { id: args.visitId }, include: { lead: true } });
    if (!visit) return false;
    const cancelled = await cancelInTx(tx, visit.id, now);
    if (!cancelled) return false;
    if (visit.lead.status === "VISIT_BOOKED") {
      await tx.lead.update({ where: { id: visit.leadId }, data: { status: "ENGAGED" } });
    }
    await logActivity(tx, {
      actorId: args.actorId,
      action: "visit.cancelled",
      entityType: "Visit",
      entityId: visit.id,
      meta: { leadId: visit.leadId, reason: args.reason ?? null },
    });
    return true;
  });
}
