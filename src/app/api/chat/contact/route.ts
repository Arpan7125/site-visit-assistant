import { NextResponse } from "next/server";
import { badRequest, chatSessionId, limitPublic } from "@/lib/chat/session";
import { prisma } from "@/lib/db";
import { contactSchema, recordContact } from "@/lib/leads/consent";

export async function POST(req: Request) {
  const sessionId = await chatSessionId();
  if (!sessionId) return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  const limited = limitPublic(req, "chat-contact", sessionId, 6);
  if (limited) return limited;
  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Please check your name and number", parsed.error.issues);

  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session?.leadId) return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  const res = await recordContact(prisma, session.leadId, parsed.data);
  if (!res.ok) return NextResponse.json({ error: "INVALID", field: res.field, message: res.message }, { status: 422 });
  return NextResponse.json({ ok: true });
}
