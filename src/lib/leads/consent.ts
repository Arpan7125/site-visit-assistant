import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { hashPhone, normalisePhone } from "./phone";

export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(24).optional(),
    consent: z.boolean(),
  })
  .strict();

/**
 * Buyer shares contact details in chat. DPDP: the phone is stored only with explicit consent.
 * Without consent the chat continues and we keep only the name.
 * If the phone already belongs to another lead, this chat lead is linked as its duplicate.
 */
export async function recordContact(
  db: PrismaClient,
  leadId: string,
  input: z.infer<typeof contactSchema>,
  now = new Date(),
): Promise<{ ok: true; duplicateOf: string | null } | { ok: false; field: string; message: string }> {
  const data = contactSchema.parse(input);
  let phoneE164: string | null = null;
  if (data.consent) {
    if (!data.phone) return { ok: false, field: "phone", message: "Please enter your phone number" };
    phoneE164 = normalisePhone(data.phone);
    if (!phoneE164) return { ok: false, field: "phone", message: "Please enter a valid Indian mobile number" };
  }
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    let duplicateOf: string | null = null;
    const phoneHash = phoneE164 ? hashPhone(phoneE164) : null;
    if (phoneHash) {
      const original = await tx.lead.findFirst({
        where: { phoneHash, id: { not: leadId }, duplicateOfId: null, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (original) {
        duplicateOf = original.id;
        if (original.source !== lead.source && !original.extraSources.includes(lead.source)) {
          await tx.lead.update({ where: { id: original.id }, data: { extraSources: { push: lead.source } } });
        }
      }
    }
    await tx.lead.update({
      where: { id: leadId },
      data: {
        name: data.name,
        ...(data.consent
          ? { phoneE164, phoneHash, consentContact: true, consentAt: now, optedOut: false, optedOutAt: null }
          : { consentContact: false }),
        ...(duplicateOf ? { duplicateOfId: duplicateOf, duplicateState: "CONFIRMED" as const } : {}),
      },
    });
    await logActivity(tx, {
      actorId: null,
      action: data.consent ? "consent.given" : "consent.declined",
      entityType: "Lead",
      entityId: leadId,
      meta: { channel: "web_chat", duplicateOf },
    });
    return { ok: true as const, duplicateOf };
  });
}

/** Opt-out: stop all contact, cancel pending reminders, keep an audit trail. */
export async function applyOptOut(db: PrismaClient, leadId: string, now = new Date()) {
  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: { optedOut: true, optedOutAt: now, consentContact: false } });
    const cancelled = await tx.reminderOutbox.updateMany({
      where: { status: "PENDING", visit: { leadId } },
      data: { status: "CANCELLED" },
    });
    await logActivity(tx, {
      actorId: null,
      action: "consent.opted_out",
      entityType: "Lead",
      entityId: leadId,
      meta: { remindersCancelled: cancelled.count },
    });
  });
}
