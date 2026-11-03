import type Anthropic from "@anthropic-ai/sdk";
import type { Language, Prisma, PrismaClient } from "@prisma/client";
import { createLead } from "@/lib/leads/create";
import { applyOptOut } from "@/lib/leads/consent";
import { bookVisit } from "@/lib/booking/book";
import { t } from "@/lib/i18n";
import { istDateKey, formatDate, formatDateTime } from "@/lib/time";
import { COPY, line } from "./copy";
import { guardReply, type GuardResult } from "./guard";
import { asksForDiscount, asksForHuman, detectScriptLanguage, isOptOut, wrongScript } from "./language";
import type { ModelProvider } from "./provider";
import { SYSTEM_RULES, contextBlock } from "./prompt";
import { TOOLS, bookingCard, handOff, runTool, type ChatCard, type TurnContext } from "./tools";

// Whole tool loop must finish within this, or the buyer gets the fixed reply and a person.
// The brief allows 2 minutes; 20 s leaves room for a slow free-tier model. Tests use 8 s.
export const MODEL_DEADLINE_MS = Number(process.env.AI_DEADLINE_MS) || 20_000;
const MAX_TOOL_ROUNDS = 5;
const HISTORY_LIMIT = 30;
export const MAX_MESSAGE_CHARS = 1000;

export type TurnResult = {
  messageId: string;
  reply: string;
  language: Language;
  cards: ChatCard[];
  flagged: boolean;
  path: "model" | "opt_out" | "human" | "discount" | "missing_fact" | "guard_blocked" | "outage";
};

/**
 * Start a chat: one lead per enquiry (source WEBSITE until we learn otherwise) and an instant,
 * fixed acknowledgement so first response time is measured in milliseconds, not hours.
 */
export async function startSession(
  db: PrismaClient,
  args: { language: Language; projectId?: string; now?: Date },
): Promise<{ sessionId: string; leadId: string; ack: string }> {
  const now = args.now ?? new Date();
  const { lead } = await createLead(db, {
    name: "Web visitor",
    source: "WEBSITE",
    projectId: args.projectId,
    language: args.language,
    createdAt: now,
  });
  const ack = line("ack", args.language);
  const session = await db.chatSession.create({
    data: {
      leadId: lead.id,
      language: args.language,
      startedAt: now,
      messages: { create: { role: "ASSISTANT", content: ack, language: args.language, createdAt: now, guardVerdict: "FIXED_TEMPLATE" } },
    },
  });
  await db.lead.update({ where: { id: lead.id }, data: { firstResponseAt: new Date() } });
  return { sessionId: session.id, leadId: lead.id, ack };
}

export async function setSessionLanguage(db: PrismaClient, sessionId: string, language: Language) {
  const s = await db.chatSession.update({ where: { id: sessionId }, data: { language } });
  if (s.leadId) await db.lead.update({ where: { id: s.leadId }, data: { language } });
}

export async function handleBuyerMessage(
  db: PrismaClient,
  provider: ModelProvider,
  args: { sessionId: string; text: string; now?: Date; humanButton?: boolean },
): Promise<TurnResult> {
  const now = args.now ?? new Date();
  const text = args.text.trim().slice(0, MAX_MESSAGE_CHARS);
  let session = await db.chatSession.findUniqueOrThrow({ where: { id: args.sessionId }, include: { lead: true } });
  if (!session.lead) throw new Error("Chat session has no lead");

  const detected = detectScriptLanguage(text);
  if (detected && detected !== session.language) {
    await setSessionLanguage(db, session.id, detected);
    session = await db.chatSession.findUniqueOrThrow({ where: { id: args.sessionId }, include: { lead: true } });
  }
  const lead = session.lead!;
  const language = session.language;

  await db.chatMessage.create({ data: { sessionId: session.id, role: "BUYER", content: text, language, createdAt: now } });
  if (lead.status === "NEW") await db.lead.update({ where: { id: lead.id }, data: { status: "ENGAGED" } });

  const ctx = newContext(db, { id: session.id, leadId: lead.id, language }, now);

  // Deterministic intercepts: these never depend on the model.
  if (isOptOut(text)) {
    await applyOptOut(db, lead.id, now);
    return finish(ctx, line("optedOut", language), "opt_out", { verdict: "OPT_OUT" });
  }
  if (args.humanButton || asksForHuman(text)) {
    await handOff(ctx, "HUMAN_REQUESTED", false);
    return finish(ctx, handoffLine(ctx, lead.phoneE164), "human", { verdict: "HUMAN_REQUESTED" });
  }
  if (asksForDiscount(text)) {
    await handOff(ctx, "DISCOUNT_ASK", true);
    return finish(ctx, `${line("discount", language)}`, "discount", { verdict: "DISCOUNT_ASK" });
  }

  // Model turn.
  const history = await db.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  ctx.evidence.buyerText = history.filter((m) => m.role === "BUYER").map((m) => m.content);
  const messages = toModelMessages(history.slice(-HISTORY_LIMIT));
  const projects = await db.project.findMany({ orderBy: { id: "asc" } });
  const system = `${SYSTEM_RULES}\n\n${contextBlock({ lead, projects, language, todayIst: `${istDateKey(now)} (${formatDate(now)})` })}`;
  const toolLog: Prisma.InputJsonValue[] = [];

  let replyText: string;
  try {
    replyText = await runModelLoop(provider, ctx, system, messages, toolLog);
  } catch (err) {
    console.error("assistant model error", err instanceof Error ? err.message : err);
    await handOff(ctx, "MODEL_ERROR", true);
    return finish(ctx, line("outage", language), "outage", { verdict: "MODEL_ERROR", toolLog });
  }

  // Missing fact: the buyer asked about something the fact sheet does not cover.
  const allSearchesEmpty = ctx.searches.length > 0 && ctx.searches.every((s) => s.hits === 0);
  if (allSearchesEmpty && !ctx.booked) {
    if (!ctx.handoff) await handOff(ctx, "MISSING_FACT", true);
    return finish(ctx, line("missingFact", language), "missing_fact", { verdict: "MISSING_FACT", toolLog });
  }

  // A reply the buyer cannot read (e.g. Bengali script in a Gujarati chat) is never shown.
  if (wrongScript(replyText, language)) {
    await handOff(ctx, "GUARD_BLOCKED", true);
    await db.chatSession.update({ where: { id: session.id }, data: { flagReason: "GUARD_BLOCKED: WRONG_SCRIPT" } });
    return finish(ctx, line("safeFallback", language), "guard_blocked", { verdict: "WRONG_SCRIPT", toolLog, blockedText: replyText });
  }

  const guard = guardReply(replyText, ctx.evidence);
  if (!guard.ok) {
    await handOff(ctx, "GUARD_BLOCKED", true);
    await db.chatSession.update({
      where: { id: session.id },
      data: { flagReason: `GUARD_BLOCKED: ${guard.violations.map((v) => v.kind).join(", ")}` },
    });
    return finish(ctx, line("safeFallback", language), "guard_blocked", { verdict: "BLOCKED", guard, toolLog, blockedText: replyText });
  }

  let reply = replyText;
  if (guard.mentionsPrice) reply = `${reply}\n\n${line("indicative", language)}`;
  if (ctx.handoff && !reply.includes(ctx.handoff.executiveName)) reply = `${reply}\n\n${handoffLine(ctx, lead.phoneE164)}`;

  await maybeSeriousBuyerHandoff(ctx);
  return finish(ctx, reply, "model", { verdict: "PASS", guard, toolLog });
}

async function runModelLoop(
  provider: ModelProvider,
  ctx: TurnContext,
  system: string,
  messages: Anthropic.MessageParam[],
  toolLog: Prisma.InputJsonValue[],
): Promise<string> {
  const deadline = Date.now() + MODEL_DEADLINE_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_DEADLINE_MS);
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("Model deadline exceeded");
      const res = await raceAbort(
        provider.create({ system, messages, tools: TOOLS }, { signal: controller.signal, timeoutMs: remaining }),
        controller.signal,
      );
      if (res.stop_reason === "refusal") throw new Error("Model refused");
      const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (res.stop_reason !== "tool_use" || !toolUses.length) {
        if (!text) throw new Error(`Empty model reply (stop_reason=${res.stop_reason})`);
        return text;
      }
      // Pass the full assistant content back unchanged (thinking blocks included).
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of toolUses) {
        const outcome = await runTool(ctx, call.name, call.input);
        toolLog.push({ name: call.name, input: call.input as Prisma.InputJsonValue, ok: outcome.ok, result: outcome.result as Prisma.InputJsonValue });
        results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(outcome.result), is_error: !outcome.ok });
      }
      messages.push({ role: "user", content: results });
    }
    throw new Error("Too many tool rounds");
  } finally {
    clearTimeout(timer);
  }
}

function newContext(db: PrismaClient, session: { id: string; leadId: string; language: Language }, now: Date): TurnContext {
  return {
    db,
    sessionId: session.id,
    leadId: session.leadId,
    language: session.language,
    now,
    evidence: { facts: [], toolText: [], buyerText: [] },
    groundedFactIds: new Set(),
    searches: [],
    cards: [],
    handoff: null,
    slotsOffered: false,
    booked: false,
  };
}

/**
 * Booking from the slot picker card. Same bookVisit as the assistant's tool, but no model in
 * the loop, so a buyer can book even while the AI is unavailable.
 */
export async function bookFromPicker(
  db: PrismaClient,
  args: { sessionId: string; slotId: string; now?: Date },
): Promise<TurnResult | { needsContact: true }> {
  const now = args.now ?? new Date();
  const session = await db.chatSession.findUniqueOrThrow({ where: { id: args.sessionId }, include: { lead: true } });
  if (!session.lead || !session.leadId) throw new Error("Chat session has no lead");
  if (session.lead.name === "Web visitor") return { needsContact: true };
  const ctx = newContext(db, { id: session.id, leadId: session.leadId, language: session.language }, now);

  const res = await bookVisit(db, { leadId: session.leadId, slotId: args.slotId, now });
  if (!res.ok) {
    const project = res.alternatives[0] ? await db.project.findUnique({ where: { id: res.alternatives[0].projectId } }) : null;
    if (project) {
      ctx.cards.push({
        type: "slots",
        projectId: project.id,
        projectName: project.name,
        slots: res.alternatives.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), label: formatDateTime(s.startsAt, ctx.language) })),
      });
    }
    return finish(ctx, t("slotTaken", ctx.language), "model", { verdict: `PICKER_${res.code}` });
  }
  ctx.booked = true;
  const card = await bookingCard(ctx, res.visit.id);
  ctx.cards.push(card);
  if (!card.remindersOn && !session.lead.optedOut) ctx.cards.push({ type: "contact", reason: "booking" });
  await maybeSeriousBuyerHandoff(ctx);
  return finish(ctx, COPY.booked[ctx.language](card.projectName, card.label), "model", { verdict: "PICKER_BOOKED" });
}

/** Resolve or reject with the provider, but never later than the abort signal. */
function raceAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("Model deadline exceeded"));
    signal.addEventListener("abort", () => reject(new Error("Model deadline exceeded")), { once: true });
    p.then(resolve, reject);
  });
}

function toModelMessages(history: { role: string; content: string }[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (m.role === "BUYER") out.push({ role: "user", content: m.content });
    else if (m.role === "ASSISTANT") out.push({ role: "assistant", content: m.content });
    else if (m.role === "EXECUTIVE") out.push({ role: "assistant", content: `[Sales team] ${m.content}` });
  }
  while (out.length && out[0].role === "assistant") out.shift();
  return out;
}

function handoffLine(ctx: TurnContext, phone: string | null): string {
  const name = ctx.handoff?.executiveName ?? "our team";
  if (!phone && !ctx.cards.some((c) => c.type === "contact")) ctx.cards.push({ type: "contact", reason: "handoff" });
  return phone ? COPY.handoff[ctx.language](name) : COPY.handoffNoContact[ctx.language](name);
}

/** Assumption A8: budget + BHK + a visit booked or asked for = serious buyer → named executive. */
async function maybeSeriousBuyerHandoff(ctx: TurnContext) {
  if (ctx.handoff) return;
  const lead = await ctx.db.lead.findUniqueOrThrow({ where: { id: ctx.leadId }, include: { visits: { where: { status: "BOOKED" } } } });
  const hasBudget = lead.budgetMinLakh != null || lead.budgetMaxLakh != null;
  if (lead.wantsBhk && hasBudget && (lead.visits.length > 0 || ctx.slotsOffered)) {
    await handOff(ctx, "SERIOUS_BUYER", false);
  }
}

async function finish(
  ctx: TurnContext,
  reply: string,
  path: TurnResult["path"],
  audit: { verdict: string; guard?: GuardResult; toolLog?: Prisma.InputJsonValue[]; blockedText?: string },
): Promise<TurnResult> {
  const msg = await ctx.db.chatMessage.create({
    data: {
      sessionId: ctx.sessionId,
      role: "ASSISTANT",
      content: reply,
      language: ctx.language,
      toolCalls: audit.toolLog?.length ? audit.toolLog : undefined,
      groundedFactIds: [...ctx.groundedFactIds],
      cards: ctx.cards.length ? (ctx.cards as unknown as Prisma.InputJsonValue) : undefined,
      guardVerdict: JSON.stringify({
        verdict: audit.verdict,
        violations: audit.guard?.violations ?? [],
        ...(audit.blockedText ? { blockedText: audit.blockedText } : {}),
      }),
    },
  });
  const session = await ctx.db.chatSession.findUniqueOrThrow({ where: { id: ctx.sessionId } });
  return { messageId: msg.id, reply, language: ctx.language, cards: ctx.cards, flagged: session.flagged, path };
}
