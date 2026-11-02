import { NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, canEditLead } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { resolvePossibleDuplicate } from "@/lib/leads/create";
import {
  NotAllowed,
  acknowledgeHandoff,
  editHandoffSummary,
  eraseLeadData,
  recordVisitOutcome,
  revealPhone,
  updateLead,
} from "@/lib/leads/actions";

const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("update"),
      status: z.enum(["NEW", "ENGAGED", "VISIT_BOOKED", "VISITED", "NO_SHOW", "HANDED_OFF", "LOST"]).optional(),
      notes: z.string().max(2000).optional(),
      assignedExecId: z.string().max(40).optional(),
    })
    .strict(),
  z.object({ action: z.literal("ack"), handoffId: z.string().max(40) }).strict(),
  z.object({ action: z.literal("summary"), handoffId: z.string().max(40), summary: z.string().trim().min(5).max(4000) }).strict(),
  z.object({ action: z.literal("outcome"), visitId: z.string().max(40), outcome: z.enum(["COMPLETED", "NO_SHOW"]) }).strict(),
  z.object({ action: z.literal("reveal") }).strict(),
  z.object({ action: z.literal("duplicate"), decision: z.enum(["merge", "dismiss"]) }).strict(),
  z.object({ action: z.literal("erase"), confirm: z.literal("DELETE") }).strict(),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await apiStaff();
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  const lead = await prisma.lead.findUnique({ where: { id }, include: { handoffs: true, visits: true } });
  if (!lead || lead.deletedAt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = parsed.data;
  const headOnly = body.action === "erase" || body.action === "duplicate" || (body.action === "update" && body.assignedExecId);
  if (headOnly && staff.role !== "SALES_HEAD") return NextResponse.json({ error: "Sales head only" }, { status: 403 });
  if (body.action !== "reveal" && !canEditLead(staff, lead)) {
    return NextResponse.json({ error: "Only the assigned executive or the sales head can change this lead" }, { status: 403 });
  }
  const ownsHandoff = (hid: string) => lead.handoffs.some((h) => h.id === hid);
  const ownsVisit = (vid: string) => lead.visits.some((v) => v.id === vid);

  try {
    switch (body.action) {
      case "update":
        await updateLead(prisma, id, { status: body.status, notes: body.notes, assignedExecId: body.assignedExecId }, staff.id);
        break;
      case "ack":
        if (!ownsHandoff(body.handoffId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        await acknowledgeHandoff(prisma, body.handoffId, staff.id);
        break;
      case "summary":
        if (!ownsHandoff(body.handoffId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        await editHandoffSummary(prisma, body.handoffId, body.summary, staff.id);
        break;
      case "outcome":
        if (!ownsVisit(body.visitId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        await recordVisitOutcome(prisma, body.visitId, body.outcome, staff.id);
        break;
      case "reveal":
        return NextResponse.json({ phone: await revealPhone(prisma, id, staff.id) });
      case "duplicate":
        await resolvePossibleDuplicate(prisma, { leadId: id, action: body.decision, actorId: staff.id });
        break;
      case "erase":
        await eraseLeadData(prisma, id, staff.id);
        break;
    }
  } catch (e) {
    if (e instanceof NotAllowed) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
