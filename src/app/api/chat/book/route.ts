import { NextResponse } from "next/server";
import { z } from "zod";
import { bookFromPicker } from "@/lib/ai/agent";
import { badRequest, chatSessionId, limitPublic } from "@/lib/chat/session";
import { prisma } from "@/lib/db";

const schema = z.object({ slotId: z.string().min(1).max(40) }).strict();

export async function POST(req: Request) {
  const sessionId = await chatSessionId();
  if (!sessionId) return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  const limited = limitPublic(req, "chat-book", sessionId, 6);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid slot");

  const res = await bookFromPicker(prisma, { sessionId, slotId: parsed.data.slotId });
  if ("needsContact" in res) return NextResponse.json({ error: "NEEDS_CONTACT" }, { status: 409 });
  return NextResponse.json({ message: { id: res.messageId, role: "ASSISTANT", content: res.reply, cards: res.cards } });
}
