import type Anthropic from "@anthropic-ai/sdk";
import type { Language, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { bookVisit } from "@/lib/booking/book";
import { getFreeSlots, type FreeSlot } from "@/lib/booking/slots";
import { searchFacts } from "@/lib/facts/search";
import { createHandoff, type HandoffReason } from "@/lib/handoff/create";
import { visitLink } from "@/lib/links";
import { DAY, formatDateTime, istToUtc } from "@/lib/time";
import type { GuardEvidence } from "./guard";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_fact_sheet",
    description:
      "Search the sales head's approved fact sheet. This is your only source of facts about the projects. Returns matching entries with ids; an empty list means the fact sheet does not cover it.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Short English keywords, e.g. 'parking', 'possession date', '3 BHK carpet area'." },
        project_id: { type: "string", description: "Project id to search, if known." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_free_slots",
    description:
      "List site-visit slots that are genuinely free right now for a project. Offer only times returned here.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        from_date: { type: "string", description: "First day to look at, YYYY-MM-DD (IST). Defaults to today." },
        days: { type: "integer", minimum: 1, maximum: 14, description: "How many days to look ahead. Default 7." },
      },
      required: ["project_id"],
      additionalProperties: false,
    },
  },
  {
    name: "book_visit",
    description:
      "Book the slot the buyer chose for this buyer. Returns the confirmed visit, or SLOT_TAKEN with alternatives if someone else just took it.",
    input_schema: {
      type: "object",
      properties: { slot_id: { type: "string" } },
      required: ["slot_id"],
      additionalProperties: false,
    },
  },
  {
    name: "update_lead_profile",
    description: "Save what the buyer told you about themselves. Only include fields the buyer actually stated.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        project_id: { type: "string" },
        bhk: { type: "integer", minimum: 1, maximum: 5 },
        budget_min_lakh: { type: "integer", minimum: 1, maximum: 1000 },
        budget_max_lakh: { type: "integer", minimum: 1, maximum: 1000 },
        timeline: { type: "string", description: "e.g. 'within 3 months', 'next year'" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "request_handoff",
    description: "Pass the conversation to a named sales executive. Use for missing facts, discount or final-price questions, or when the buyer asks for a person.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", enum: ["MISSING_FACT", "DISCOUNT_ASK", "HUMAN_REQUESTED", "OTHER"] },
        note: { type: "string", description: "One line for the executive." },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
];

const id = z.string().min(1).max(40);
const SCHEMAS = {
  search_fact_sheet: z.object({ query: z.string().min(1).max(200), project_id: id.optional() }).strict(),
  get_free_slots: z
    .object({
      project_id: id,
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      days: z.number().int().min(1).max(14).optional(),
    })
    .strict(),
  book_visit: z.object({ slot_id: id }).strict(),
  update_lead_profile: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      project_id: id.optional(),
      bhk: z.number().int().min(1).max(5).optional(),
      budget_min_lakh: z.number().int().min(1).max(1000).optional(),
      budget_max_lakh: z.number().int().min(1).max(1000).optional(),
      timeline: z.string().trim().max(80).optional(),
    })
    .strict(),
  request_handoff: z
    .object({ reason: z.enum(["MISSING_FACT", "DISCOUNT_ASK", "HUMAN_REQUESTED", "OTHER"]), note: z.string().max(300).optional() })
    .strict(),
} as const;

export type ToolName = keyof typeof SCHEMAS;

export type ChatCard =
  | { type: "slots"; projectId: string; projectName: string; slots: { id: string; startsAt: string; label: string }[] }
  | {
      type: "booking";
      visitId: string;
      link: string;
      startsAt: string;
      label: string;
      projectName: string;
      address: string;
      mapUrl: string;
      reraNumber: string;
      remindersOn: boolean;
    }
  | { type: "contact"; reason: "booking" | "handoff" }
  | { type: "handoff"; executiveName: string };

/** Per-turn state the tools write to. leadId and sessionId come from the session, never the model. */
export type TurnContext = {
  db: PrismaClient;
  sessionId: string;
  leadId: string;
  language: Language;
  now: Date;
  evidence: GuardEvidence;
  groundedFactIds: Set<string>;
  searches: { query: string; hits: number }[];
  cards: ChatCard[];
  handoff: { reason: HandoffReason; executiveName: string } | null;
  slotsOffered: boolean;
  booked: boolean;
};

export type ToolOutcome = { ok: boolean; result: unknown };

const REASON_MAP: Record<z.infer<typeof SCHEMAS.request_handoff>["reason"], HandoffReason> = {
  MISSING_FACT: "MISSING_FACT",
  DISCOUNT_ASK: "DISCOUNT_ASK",
  HUMAN_REQUESTED: "HUMAN_REQUESTED",
  OTHER: "MODEL_REQUESTED",
};

export async function handOff(ctx: TurnContext, reason: HandoffReason, flag: boolean) {
  const res = await createHandoff(ctx.db, { leadId: ctx.leadId, sessionId: ctx.sessionId, reason, flag, now: ctx.now });
  ctx.handoff = { reason, executiveName: res.executive.name };
  if (!ctx.cards.some((c) => c.type === "handoff")) ctx.cards.push({ type: "handoff", executiveName: res.executive.name });
  return res;
}

function slotLabel(s: FreeSlot, lang: Language) {
  return formatDateTime(s.startsAt, lang);
}

async function slotsCard(ctx: TurnContext, projectId: string, slots: FreeSlot[]) {
  const project = await ctx.db.project.findUnique({ where: { id: projectId } });
  ctx.cards = ctx.cards.filter((c) => c.type !== "slots");
  ctx.cards.push({
    type: "slots",
    projectId,
    projectName: project?.name ?? projectId,
    slots: slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), label: slotLabel(s, ctx.language) })),
  });
}

export async function bookingCard(ctx: Pick<TurnContext, "db" | "language">, visitId: string): Promise<Extract<ChatCard, { type: "booking" }>> {
  const v = await ctx.db.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { slot: { include: { project: true } }, lead: true },
  });
  const p = v.slot.project;
  return {
    type: "booking",
    visitId: v.id,
    link: visitLink(v.id, v.slot.startsAt),
    startsAt: v.slot.startsAt.toISOString(),
    label: formatDateTime(v.slot.startsAt, ctx.language),
    projectName: p.name,
    address: p.address,
    mapUrl: p.mapUrl,
    reraNumber: p.reraNumber,
    remindersOn: v.lead.consentContact && !v.lead.optedOut && !!v.lead.phoneE164,
  };
}

export async function runTool(ctx: TurnContext, name: string, rawInput: unknown): Promise<ToolOutcome> {
  if (!(name in SCHEMAS)) return { ok: false, result: { error: "UNKNOWN_TOOL" } };
  const parsed = SCHEMAS[name as ToolName].safeParse(rawInput);
  if (!parsed.success) return { ok: false, result: { error: "INVALID_INPUT", issues: parsed.error.issues.map((i) => i.message) } };
  const { db } = ctx;

  switch (name as ToolName) {
    case "search_fact_sheet": {
      const input = parsed.data as z.infer<typeof SCHEMAS.search_fact_sheet>;
      const lead = await db.lead.findUniqueOrThrow({ where: { id: ctx.leadId } });
      const hits = await searchFacts(db, {
        query: input.query,
        projectId: input.project_id ?? lead.projectId,
        language: ctx.language,
      });
      ctx.searches.push({ query: input.query, hits: hits.length });
      for (const h of hits) {
        ctx.groundedFactIds.add(h.id);
        // Evidence includes the English text too: the reply may translate it.
        const entry = await db.factSheetEntry.findUnique({ where: { id: h.id } });
        ctx.evidence.facts.push({
          id: h.id,
          text: [h.value, entry?.valueEn, entry?.valueHi, entry?.valueGu].filter(Boolean).join(" | "),
          quotable: h.quotable,
        });
      }
      return {
        ok: true,
        result: {
          entries: hits.map((h) => ({ id: h.id, project_id: h.projectId, topic: h.key, value: h.value, quotable: h.quotable })),
          note: hits.length ? undefined : "No fact sheet entry covers this. Do not answer from memory; hand off.",
        },
      };
    }

    case "get_free_slots": {
      const input = parsed.data as z.infer<typeof SCHEMAS.get_free_slots>;
      const project = await db.project.findUnique({ where: { id: input.project_id } });
      if (!project) return { ok: false, result: { error: "UNKNOWN_PROJECT" } };
      const from = input.from_date ? istToUtc(input.from_date, 0) : ctx.now;
      const to = new Date(from.getTime() + (input.days ?? 7) * DAY);
      const slots = await getFreeSlots(db, { projectId: project.id, from, to, now: ctx.now, limit: 12 });
      ctx.slotsOffered = true;
      ctx.evidence.toolText.push(...slots.map((s) => slotLabel(s, ctx.language)), ...slots.map((s) => slotLabel(s, "EN")));
      await slotsCard(ctx, project.id, slots);
      return {
        ok: true,
        result: {
          project: project.name,
          slots: slots.map((s) => ({ slot_id: s.id, time_ist: slotLabel(s, ctx.language) })),
          note: slots.length ? "The buyer also sees these as buttons." : "No free slots in this window; try later dates.",
        },
      };
    }

    case "book_visit": {
      const input = parsed.data as z.infer<typeof SCHEMAS.book_visit>;
      const lead = await db.lead.findUniqueOrThrow({ where: { id: ctx.leadId } });
      if (lead.name === "Web visitor") {
        if (!ctx.cards.some((c) => c.type === "contact")) ctx.cards.push({ type: "contact", reason: "booking" });
        return { ok: false, result: { error: "NAME_REQUIRED", note: "Ask the buyer to fill in the short contact form shown below, then book." } };
      }
      const res = await bookVisit(db, { leadId: ctx.leadId, slotId: input.slot_id, now: ctx.now });
      if (!res.ok) {
        if (res.alternatives.length) await slotsCard(ctx, res.alternatives[0].projectId, res.alternatives);
        ctx.evidence.toolText.push(...res.alternatives.map((s) => slotLabel(s, ctx.language)));
        return {
          ok: false,
          result: {
            error: res.code,
            alternatives: res.alternatives.map((s) => ({ slot_id: s.id, time_ist: slotLabel(s, ctx.language) })),
          },
        };
      }
      ctx.booked = true;
      const card = await bookingCard(ctx, res.visit.id);
      ctx.cards = ctx.cards.filter((c) => c.type !== "slots");
      ctx.cards.push(card);
      ctx.evidence.toolText.push(card.label, formatDateTime(res.slot.startsAt, "EN"), card.address, card.reraNumber);
      if (!card.remindersOn && !lead.optedOut && !ctx.cards.some((c) => c.type === "contact")) {
        ctx.cards.push({ type: "contact", reason: "booking" });
      }
      return {
        ok: true,
        result: {
          visit_id: res.visit.id,
          time_ist: card.label,
          project: card.projectName,
          address: card.address,
          rera: card.reraNumber,
          reminders: card.remindersOn ? "WhatsApp reminders 1 day and 2 hours before" : "No reminders (no contact consent)",
          note: "A confirmation card with map and calendar link is shown to the buyer.",
        },
      };
    }

    case "update_lead_profile": {
      const input = parsed.data as z.infer<typeof SCHEMAS.update_lead_profile>;
      if (input.project_id && !(await db.project.findUnique({ where: { id: input.project_id } }))) {
        return { ok: false, result: { error: "UNKNOWN_PROJECT" } };
      }
      const data = {
        name: input.name,
        projectId: input.project_id,
        wantsBhk: input.bhk,
        budgetMinLakh: input.budget_min_lakh,
        budgetMaxLakh: input.budget_max_lakh,
        timeline: input.timeline,
      };
      await db.lead.update({ where: { id: ctx.leadId }, data });
      ctx.evidence.toolText.push(...Object.values(data).filter((v) => v !== undefined).map(String));
      return { ok: true, result: { saved: Object.keys(input) } };
    }

    case "request_handoff": {
      const input = parsed.data as z.infer<typeof SCHEMAS.request_handoff>;
      const reason = REASON_MAP[input.reason];
      const res = await handOff(ctx, reason, reason === "MISSING_FACT" || reason === "DISCOUNT_ASK");
      return { ok: true, result: { executive: res.executive.name } };
    }
  }
}
