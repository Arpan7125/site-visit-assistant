import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { apiStaff } from "@/lib/authz";
import { prisma } from "@/lib/db";

const schema = z.object({ sessionId: z.string().min(1).max(40), note: z.string().max(500).optional() }).strict();

/** The sales head's daily review of flagged chats: mark one as reviewed. */
export async function POST(req: Request) {
  const staff = await apiStaff("SALES_HEAD");
  if (staff instanceof NextResponse) return staff;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const s = await prisma.chatSession.update({
    where: { id: parsed.data.sessionId },
    data: { reviewedAt: new Date(), reviewedById: staff.id },
  });
  await logActivity(prisma, {
    actorId: staff.id,
    action: "chat.reviewed",
    entityType: "ChatSession",
    entityId: s.id,
    meta: { flagReason: s.flagReason, note: parsed.data.note ?? null },
  });
  return NextResponse.json({ ok: true });
}
