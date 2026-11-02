import type { Language, Lead, LeadSource, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { Db } from "@/lib/db";
import { hashPhone, normalisePhone } from "./phone";
import { FUZZY_NAME_THRESHOLD, nameSimilarity } from "./similarity";

export const LEAD_SOURCES = ["PORTAL", "SOCIAL_AD", "WEBSITE", "HOARDING_CALL", "WHATSAPP"] as const;

export const leadInputSchema = z
  .object({
    id: z.string().regex(/^LD-\d{5}$/).optional(),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(24).optional(),
    email: z.string().trim().email().max(120).optional(),
    source: z.enum(LEAD_SOURCES),
    projectId: z.string().max(40).optional(),
    wantsBhk: z.number().int().min(1).max(5).optional(),
    budgetMinLakh: z.number().int().min(1).max(1000).optional(),
    budgetMaxLakh: z.number().int().min(1).max(1000).optional(),
    language: z.enum(["EN", "HI", "GU"]).optional(),
    consentContact: z.boolean().optional(),
    createdAt: z.date().optional(),
  })
  .strict();

export type LeadInput = z.infer<typeof leadInputSchema>;

export type CreateLeadResult = {
  lead: Lead;
  duplicate: "NONE" | "CONFIRMED" | "POSSIBLE";
  originalId: string | null;
};

export async function nextLeadId(db: Db): Promise<string> {
  const [row] = await db.$queryRaw<{ n: bigint }[]>`SELECT nextval('lead_number_seq') AS n`;
  return `LD-${row.n.toString().padStart(5, "0")}`;
}

/**
 * Create a lead from any source, running the duplicate check:
 *  - exact phone match (by HMAC hash of E.164) → linked as CONFIRMED duplicate of the original,
 *    and the new source is added to the original's tags so one person shows once with all sources;
 *  - otherwise similar name on the same project → POSSIBLE duplicate for a human to merge or dismiss.
 */
export async function createLead(
  db: PrismaClient,
  input: LeadInput,
  opts: { actorId?: string | null } = {},
): Promise<CreateLeadResult> {
  const data = leadInputSchema.parse(input);
  let phoneE164: string | null = null;
  if (data.phone) {
    phoneE164 = normalisePhone(data.phone);
    if (!phoneE164) throw new LeadValidationError("phone", "Not a valid Indian phone number");
  }
  const phoneHash = phoneE164 ? hashPhone(phoneE164) : null;

  return db.$transaction(async (tx) => {
    let duplicate: CreateLeadResult["duplicate"] = "NONE";
    let original: Pick<Lead, "id" | "source" | "extraSources"> | null = null;

    if (phoneHash) {
      original = await tx.lead.findFirst({
        where: { phoneHash, duplicateOfId: null, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, source: true, extraSources: true },
      });
      if (original) duplicate = "CONFIRMED";
    }
    if (!original) {
      const candidates = await tx.lead.findMany({
        where: { projectId: data.projectId ?? null, duplicateOfId: null, deletedAt: null },
        select: { id: true, name: true, source: true, extraSources: true },
        orderBy: { createdAt: "asc" },
        take: 2000,
      });
      const match = candidates.find((c) => nameSimilarity(c.name, data.name) >= FUZZY_NAME_THRESHOLD);
      if (match) {
        original = match;
        duplicate = "POSSIBLE";
      }
    }

    const id = data.id ?? (await nextLeadId(tx));
    const lead = await tx.lead.create({
      data: {
        id,
        name: data.name,
        phoneE164,
        phoneHash,
        email: data.email,
        source: data.source as LeadSource,
        projectId: data.projectId,
        wantsBhk: data.wantsBhk,
        budgetMinLakh: data.budgetMinLakh,
        budgetMaxLakh: data.budgetMaxLakh,
        language: (data.language ?? "EN") as Language,
        consentContact: data.consentContact ?? false,
        consentAt: data.consentContact ? (data.createdAt ?? new Date()) : null,
        duplicateOfId: original?.id ?? null,
        duplicateState: duplicate,
        firstContactAt: data.createdAt ?? new Date(),
        createdAt: data.createdAt ?? new Date(),
      },
    });

    if (duplicate === "CONFIRMED" && original) {
      await addSourceTag(tx, original, lead.source);
    }
    await logActivity(tx, {
      actorId: opts.actorId ?? null,
      action: duplicate === "NONE" ? "lead.created" : `lead.created.duplicate_${duplicate.toLowerCase()}`,
      entityType: "Lead",
      entityId: lead.id,
      meta: { source: lead.source, originalId: original?.id ?? null },
    });
    return { lead, duplicate, originalId: original?.id ?? null };
  });
}

async function addSourceTag(db: Db, original: Pick<Lead, "id" | "source" | "extraSources">, source: LeadSource) {
  if (original.source === source || original.extraSources.includes(source)) return;
  await db.lead.update({ where: { id: original.id }, data: { extraSources: { push: source } } });
}

/** Human review of a POSSIBLE duplicate: merge links it for good, dismiss clears the suggestion. */
export async function resolvePossibleDuplicate(
  db: PrismaClient,
  args: { leadId: string; action: "merge" | "dismiss"; actorId: string },
) {
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: args.leadId }, include: { duplicateOf: true } });
    if (!lead || lead.duplicateState !== "POSSIBLE" || !lead.duplicateOf) return null;
    const updated =
      args.action === "merge"
        ? await tx.lead.update({ where: { id: lead.id }, data: { duplicateState: "CONFIRMED" } })
        : await tx.lead.update({ where: { id: lead.id }, data: { duplicateState: "DISMISSED", duplicateOfId: null } });
    if (args.action === "merge") await addSourceTag(tx, lead.duplicateOf, lead.source);
    await logActivity(tx, {
      actorId: args.actorId,
      action: `lead.duplicate_${args.action}`,
      entityType: "Lead",
      entityId: lead.id,
      meta: { originalId: lead.duplicateOf.id },
    });
    return updated;
  });
}

export class LeadValidationError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
  }
}
