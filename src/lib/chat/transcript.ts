import type { PrismaClient } from "@prisma/client";
import type { ChatCard } from "@/lib/ai/tools";
import type { Lang } from "@/lib/i18n";

export type UiMessage = { id: string; role: "BUYER" | "ASSISTANT" | "EXECUTIVE"; content: string; cards: ChatCard[] };
export type ChatState = {
  language: Lang;
  messages: UiMessage[];
  lead: { hasName: boolean; hasPhone: boolean; consent: boolean; optedOut: boolean; projectId: string | null };
};

export async function chatState(db: PrismaClient, sessionId: string): Promise<ChatState | null> {
  const s = await db.chatSession.findUnique({
    where: { id: sessionId },
    include: { lead: true, messages: { orderBy: { createdAt: "asc" }, where: { role: { not: "SYSTEM" } } } },
  });
  if (!s || !s.lead || s.lead.deletedAt) return null;
  return {
    language: s.language,
    messages: s.messages.map((m) => ({
      id: m.id,
      role: m.role as UiMessage["role"],
      content: m.content,
      cards: (m.cards as unknown as ChatCard[] | null) ?? [],
    })),
    lead: {
      hasName: s.lead.name !== "Web visitor",
      hasPhone: !!s.lead.phoneE164,
      consent: s.lead.consentContact,
      optedOut: s.lead.optedOut,
      projectId: s.lead.projectId,
    },
  };
}
