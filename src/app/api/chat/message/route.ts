import { NextResponse } from "next/server";
import { z } from "zod";
import { handleBuyerMessage, MAX_MESSAGE_CHARS } from "@/lib/ai/agent";
import { defaultProvider } from "@/lib/ai/provider";
import { badRequest, chatSessionId, limitPublic } from "@/lib/chat/session";
import { prisma } from "@/lib/db";

export const maxDuration = 30;

const schema = z
  .object({
    text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS).optional(),
    human: z.literal(true).optional(),
  })
  .strict()
  .refine((v) => v.text || v.human, "text or human is required");

export async function POST(req: Request) {
  const sessionId = await chatSessionId();
  if (!sessionId) return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  const limited = limitPublic(req, "chat-msg", sessionId, 12);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid message", parsed.error.issues);

  const result = await handleBuyerMessage(prisma, defaultProvider(), {
    sessionId,
    text: parsed.data.text ?? "I would like to talk to a person.",
    humanButton: parsed.data.human,
  });
  return NextResponse.json({
    message: { id: result.messageId, role: "ASSISTANT", content: result.reply, cards: result.cards },
    language: result.language,
  });
}
