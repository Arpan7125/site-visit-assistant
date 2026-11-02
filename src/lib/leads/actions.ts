import type { LeadStatus, PrismaClient, VisitStatus } from "@prisma/client";
import { logActivity } from "@/lib/activity";

export class NotAllowed extends Error {}

export async function acknowledgeHandoff(db: PrismaClient, handoffId: string, actorId: string) {
  const h = await db.handoff.update({ where: { id: handoffId }, data: { acknowledgedAt: new Date() } });
  await logActivity(db, { actorId, action: "handoff.acknowledged", entityType: "Lead", entityId: h.leadId, meta: { handoffId } });
  return h;
}

export async function editHandoffSummary(db: PrismaClient, handoffId: string, summary: string, actorId: string) {
  const h = await db.handoff.update({ where: { id: handoffId }, data: { summary, summaryEdited: true } });
  await logActivity(db, { actorId, action: "handoff.summary_edited", entityType: "Lead", entityId: h.leadId, meta: { handoffId } });
  return h;
}

export async function updateLead(
  db: PrismaClient,
  leadId: string,
  data: { status?: LeadStatus; notes?: string; assignedExecId?: string },
  actorId: string,
) {
  const before = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const lead = await db.lead.update({ where: { id: leadId }, data });
  await logActivity(db, {
    actorId,
    action: "lead.updated",
    entityType: "Lead",
    entityId: leadId,
    meta: {
      ...(data.status && data.status !== before.status ? { status: [before.status, data.status] } : {}),
      ...(data.assignedExecId && data.assignedExecId !== before.assignedExecId ? { assignedExecId: [before.assignedExecId, data.assignedExecId] } : {}),
      ...(data.notes !== undefined ? { notesChanged: true } : {}),
    },
  });
  return lead;
}

/** Record what happened at the visit. Only a visit whose time has passed can get an outcome. */
export async function recordVisitOutcome(db: PrismaClient, visitId: string, outcome: Extract<VisitStatus, "COMPLETED" | "NO_SHOW">, actorId: string, now = new Date()) {
  const visit = await db.visit.findUniqueOrThrow({ where: { id: visitId }, include: { slot: true } });
  if (visit.slot.startsAt > now) throw new NotAllowed("The visit hasn't happened yet");
  if (visit.status === "CANCELLED") throw new NotAllowed("This visit was cancelled");
  await db.$transaction([
    db.visit.update({ where: { id: visitId }, data: { status: outcome, outcomeAt: now } }),
    db.reminderOutbox.updateMany({ where: { visitId, status: "PENDING" }, data: { status: "CANCELLED" } }),
    db.lead.update({ where: { id: visit.leadId }, data: { status: outcome === "COMPLETED" ? "VISITED" : "NO_SHOW" } }),
  ]);
  await logActivity(db, { actorId, action: `visit.${outcome.toLowerCase()}`, entityType: "Visit", entityId: visitId, meta: { leadId: visit.leadId } });
}

/** Viewing a full phone number is logged (DPDP accountability). */
export async function revealPhone(db: PrismaClient, leadId: string, actorId: string): Promise<string | null> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  await logActivity(db, { actorId, action: "lead.phone_viewed", entityType: "Lead", entityId: leadId });
  return lead.phoneE164;
}

/**
 * DPDP erasure on request: personal data is removed, the anonymous record stays so the
 * aggregate numbers (and the slot history) remain correct. Pending reminders are cancelled.
 */
export async function eraseLeadData(db: PrismaClient, leadId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: { name: "Deleted on request", phoneE164: null, phoneHash: null, email: null, notes: null, consentContact: false, optedOut: true, deletedAt: new Date() },
    });
    await tx.chatMessage.updateMany({ where: { session: { leadId }, role: "BUYER" }, data: { content: "[removed on request]" } });
    await tx.handoff.updateMany({ where: { leadId }, data: { summary: "[removed on request]" } });
    await tx.reminderOutbox.updateMany({ where: { visit: { leadId }, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.reminderOutbox.updateMany({ where: { visit: { leadId } }, data: { body: null } });
    await tx.visit.updateMany({ where: { leadId, status: "BOOKED" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await logActivity(tx, { actorId, action: "lead.erased", entityType: "Lead", entityId: leadId });
  });
}
