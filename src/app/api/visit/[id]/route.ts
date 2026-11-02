import { NextResponse } from "next/server";
import { z } from "zod";
import { bookVisit, cancelVisit } from "@/lib/booking/book";
import { badRequest, limitPublic } from "@/lib/chat/session";
import { prisma } from "@/lib/db";
import { verifyToken, visitLink } from "@/lib/links";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), t: z.string().max(200) }).strict(),
  z.object({ action: z.literal("reschedule"), t: z.string().max(200), slotId: z.string().min(1).max(40) }).strict(),
]);

/** Buyer self-service from the signed visit link: cancel, or move to another free slot. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limited = limitPublic(req, "visit", id, 6);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request");
  if (!verifyToken("visit", id, parsed.data.t)) return NextResponse.json({ error: "LINK_INVALID" }, { status: 403 });

  const visit = await prisma.visit.findUnique({ where: { id }, include: { slot: true } });
  if (!visit || visit.status !== "BOOKED") return NextResponse.json({ error: "NOT_ACTIVE" }, { status: 409 });

  if (parsed.data.action === "cancel") {
    await cancelVisit(prisma, { visitId: id, actorId: null, reason: "buyer_self_service" });
    return NextResponse.json({ ok: true });
  }
  const target = await prisma.visitSlot.findUnique({ where: { id: parsed.data.slotId } });
  if (!target || target.projectId !== visit.slot.projectId) return badRequest("Choose a time for the same project");
  const res = await bookVisit(prisma, { leadId: visit.leadId, slotId: target.id });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.code, alternatives: res.alternatives.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString() })) },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, link: visitLink(res.visit.id, res.slot.startsAt) });
}
