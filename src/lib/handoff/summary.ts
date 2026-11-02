import type { ChatMessage, Lead, Project, Visit, VisitSlot } from "@prisma/client";
import { formatDateTime } from "@/lib/time";

const SOURCE_LABEL: Record<Lead["source"], string> = {
  PORTAL: "Property portal",
  SOCIAL_AD: "Social media ad",
  WEBSITE: "Website",
  HOARDING_CALL: "Hoarding call",
  WHATSAPP: "WhatsApp",
};

export const REASON_LABEL: Record<string, string> = {
  HUMAN_REQUESTED: "Buyer asked for a person",
  SERIOUS_BUYER: "Serious buyer (budget, BHK and visit)",
  MISSING_FACT: "Question not covered by the fact sheet",
  DISCOUNT_ASK: "Asked about discount or final price",
  GUARD_BLOCKED: "Assistant reply blocked by guardrail",
  MODEL_ERROR: "Assistant unavailable",
  MODEL_REQUESTED: "Assistant requested a person",
};

/** Field-list summary that never depends on the model. Used directly and as the AI fallback. */
export function deterministicSummary(args: {
  lead: Lead & { project: Project | null };
  reason: string;
  messages: Pick<ChatMessage, "role" | "content">[];
  visit: (Visit & { slot: VisitSlot }) | null;
}): string {
  const { lead, visit } = args;
  const budget =
    lead.budgetMinLakh || lead.budgetMaxLakh
      ? `₹${lead.budgetMinLakh ?? "?"}–${lead.budgetMaxLakh ?? "?"} lakh (buyer stated)`
      : "not given";
  const lastBuyer = [...args.messages].reverse().find((m) => m.role === "BUYER")?.content;
  return [
    `Reason: ${REASON_LABEL[args.reason] ?? args.reason}`,
    `Source: ${SOURCE_LABEL[lead.source]}`,
    `Project: ${lead.project?.name ?? "not decided"}`,
    `Wants: ${lead.wantsBhk ? `${lead.wantsBhk} BHK` : "not given"}`,
    `Budget: ${budget}`,
    `Timeline: ${lead.timeline ?? "not given"}`,
    `Language: ${lead.language}`,
    `Visit: ${visit ? formatDateTime(visit.slot.startsAt) + " (" + visit.status.toLowerCase() + ")" : "none booked"}`,
    `Contact consent: ${lead.consentContact ? "yes" : "no"}${lead.optedOut ? " (opted out)" : ""}`,
    lastBuyer ? `Last buyer message: "${lastBuyer.slice(0, 200)}"` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
