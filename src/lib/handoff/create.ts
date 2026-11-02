import type { Handoff, PrismaClient, User } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import { executiveLoads, pickExecutive } from "./assign";
import { deterministicSummary } from "./summary";

export type HandoffReason =
  | "HUMAN_REQUESTED"
  | "SERIOUS_BUYER"
  | "MISSING_FACT"
  | "DISCOUNT_ASK"
  | "GUARD_BLOCKED"
  | "MODEL_ERROR"
  | "MODEL_REQUESTED";

/**
 * Hand a lead to a named executive with a summary. Idempotent per lead: while a handoff is
 * open (not acknowledged) a new trigger returns it instead of creating another.
 * The lead keeps its executive once assigned, so a buyer always deals with the same person.
 */
export async function createHandoff(
  db: PrismaClient,
  args: { leadId: string; sessionId: string | null; reason: HandoffReason; flag?: boolean; now?: Date },
): Promise<{ handoff: Handoff; executive: Pick<User, "id" | "name">; created: boolean }> {
  const now = args.now ?? new Date();
  return db.$transaction(async (tx) => {
    // Serialise handoffs for one lead so two triggers in one turn cannot both create.
    await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${args.leadId} FOR UPDATE`;
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: args.leadId },
      include: { project: true, assignedExec: true },
    });
    if (args.sessionId) {
      await tx.chatSession.update({
        where: { id: args.sessionId },
        data: {
          ...(args.reason === "HUMAN_REQUESTED" ? { humanRequested: true } : {}),
          ...(args.flag ? { flagged: true, flagReason: args.reason, reviewedAt: null } : {}),
        },
      });
    }
    const open = await tx.handoff.findFirst({
      where: { leadId: lead.id, acknowledgedAt: null },
      include: { executive: { select: { id: true, name: true } } },
    });
    if (open) return { handoff: open, executive: open.executive, created: false };

    let executive = lead.assignedExec?.active ? { id: lead.assignedExec.id, name: lead.assignedExec.name } : null;
    if (!executive) {
      const pick = pickExecutive(await executiveLoads(tx, now));
      if (!pick) throw new Error("No active executive to hand off to");
      executive = { id: pick.id, name: pick.name };
    }

    const [messages, visit] = await Promise.all([
      args.sessionId
        ? tx.chatMessage.findMany({ where: { sessionId: args.sessionId }, orderBy: { createdAt: "asc" } })
        : Promise.resolve([]),
      tx.visit.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, include: { slot: true } }),
    ]);
    const handoff = await tx.handoff.create({
      data: {
        leadId: lead.id,
        sessionId: args.sessionId,
        executiveId: executive.id,
        reason: args.reason,
        summary: deterministicSummary({ lead, reason: args.reason, messages, visit }),
        createdAt: now,
      },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        assignedExecId: executive.id,
        status: ["NEW", "ENGAGED"].includes(lead.status) ? "HANDED_OFF" : lead.status,
      },
    });
    await tx.visit.updateMany({ where: { leadId: lead.id, status: "BOOKED", executiveId: null }, data: { executiveId: executive.id } });
    await logActivity(tx, {
      actorId: null,
      action: "handoff.created",
      entityType: "Lead",
      entityId: lead.id,
      meta: { handoffId: handoff.id, executiveId: executive.id, reason: args.reason },
    });
    return { handoff, executive, created: true };
  });
}
