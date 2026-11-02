import type { PrismaClient, ReminderStatus } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import { renderTemplate } from "@/lib/messaging/templates";
import { formatDateTime } from "@/lib/time";

export type SendSummary = { processed: number; sent: number; skipped: number; cancelled: number };

/**
 * Deliver due reminders through the mock channel (the "message log").
 * Idempotent: each row moves out of PENDING with a conditional update, so overlapping cron
 * runs cannot send twice. Consent and opt-out are re-checked here, at send time.
 */
export async function sendDueReminders(db: PrismaClient, now = new Date(), batch = 100): Promise<SendSummary> {
  const due = await db.reminderOutbox.findMany({
    where: { status: "PENDING", sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: batch,
    include: { visit: { include: { lead: true, slot: { include: { project: true } } } } },
  });
  const summary: SendSummary = { processed: 0, sent: 0, skipped: 0, cancelled: 0 };

  for (const r of due) {
    const { lead, slot } = r.visit;
    let status: ReminderStatus = "SENT";
    let body: string | null = null;
    if (r.visit.status !== "BOOKED" || slot.startsAt <= now) status = "CANCELLED";
    else if (lead.optedOut || lead.deletedAt) status = "SKIPPED_OPTED_OUT";
    else if (!lead.consentContact || !lead.phoneE164) status = "SKIPPED_NO_CONSENT";
    else {
      const template =
        (await db.messageTemplate.findFirst({ where: { name: r.templateId, language: lead.language, approved: true } })) ??
        (await db.messageTemplate.findFirst({ where: { name: r.templateId, language: "EN", approved: true } }));
      if (!template) throw new Error(`No approved template ${r.templateId}`);
      body = renderTemplate(
        template.body,
        {
          name: lead.name.split(" ")[0],
          project: slot.project.name,
          time: formatDateTime(slot.startsAt, lead.language),
          address: slot.project.address,
          map: slot.project.mapUrl,
          rera: slot.project.reraNumber,
        },
        template.requiresReraNumber,
      );
    }

    const claimed = await db.reminderOutbox.updateMany({
      where: { id: r.id, status: "PENDING" },
      data: { status, body, sentAt: status === "SENT" ? now : null },
    });
    if (!claimed.count) continue; // another run got it first
    summary.processed++;
    if (status === "SENT") summary.sent++;
    else if (status === "CANCELLED") summary.cancelled++;
    else {
      summary.skipped++;
      await logActivity(db, {
        actorId: null,
        action: `reminder.${status.toLowerCase()}`,
        entityType: "ReminderOutbox",
        entityId: r.id,
        meta: { leadId: lead.id, visitId: r.visitId },
      });
    }
  }
  return summary;
}
