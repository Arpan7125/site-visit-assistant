import type { LeadSource, LeadStatus, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { istToUtc } from "@/lib/time";

export const PAGE_SIZE = 20;

export const leadFilterSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  source: z.enum(["PORTAL", "SOCIAL_AD", "WEBSITE", "HOARDING_CALL", "WHATSAPP"]).optional().catch(undefined),
  project: z.string().max(40).optional().catch(undefined),
  status: z.enum(["NEW", "ENGAGED", "VISIT_BOOKED", "VISITED", "NO_SHOW", "HANDED_OFF", "LOST"]).optional().catch(undefined),
  dup: z.enum(["possible", "any"]).optional().catch(undefined),
  mine: z.literal("1").optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  sort: z.enum(["newest", "oldest", "response", "name"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type LeadFilters = z.infer<typeof leadFilterSchema>;

export async function listLeads(db: PrismaClient, f: LeadFilters, viewerId: string) {
  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { id: { contains: f.q.toUpperCase() } },
      ...(digits.length >= 4 ? [{ phoneE164: { endsWith: digits.slice(-10) } }] : []),
    ];
  }
  // A merged lead carries every source it came from, so filter on both.
  if (f.source) where.AND = [{ OR: [{ source: f.source as LeadSource }, { extraSources: { has: f.source as LeadSource } }] }];
  if (f.project) where.projectId = f.project;
  if (f.status) where.status = f.status as LeadStatus;
  if (f.dup === "possible") where.duplicateState = "POSSIBLE";
  if (f.dup === "any") where.duplicateState = { in: ["POSSIBLE", "CONFIRMED"] };
  if (f.mine) where.assignedExecId = viewerId;
  if (f.from || f.to) {
    where.createdAt = {
      ...(f.from ? { gte: istToUtc(f.from, 0) } : {}),
      ...(f.to ? { lt: new Date(istToUtc(f.to, 0).getTime() + 86_400_000) } : {}),
    };
  }
  const orderBy: Prisma.LeadOrderByWithRelationInput =
    f.sort === "oldest" ? { createdAt: "asc" } : f.sort === "name" ? { name: "asc" } : f.sort === "response" ? { firstResponseAt: { sort: "desc", nulls: "first" } } : { createdAt: "desc" };
  const page = f.page ?? 1;
  const [total, rows] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        project: { select: { name: true } },
        assignedExec: { select: { name: true } },
        visits: { where: { status: "BOOKED" }, include: { slot: true }, take: 1 },
        handoffs: { where: { acknowledgedAt: null }, select: { id: true }, take: 1 },
      },
    }),
  ]);
  return { total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), rows };
}
