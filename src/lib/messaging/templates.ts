import type { Language } from "@prisma/client";

/**
 * Mock "WhatsApp-approved" templates. Real WhatsApp Business templates are pre-approved by Meta
 * and may only fill placeholders; we model that by refusing to send anything not listed here.
 * Every template that can reach a buyer carries the project's RERA number (RERA rule).
 */
export const TEMPLATE_SEED: { id: string; name: string; language: Language; body: string }[] = [
  {
    id: "visit_reminder_1d_en",
    name: "visit_reminder_1d",
    language: "EN",
    body: "Hello {{name}}, a reminder that your site visit to {{project}} is tomorrow, {{time}}. Address: {{address}}. Map: {{map}}. RERA No. {{rera}}. Reply STOP to opt out.",
  },
  {
    id: "visit_reminder_1d_hi",
    name: "visit_reminder_1d",
    language: "HI",
    body: "नमस्ते {{name}}, याद दिला दें कि {{project}} पर आपकी साइट विज़िट कल, {{time}} है। पता: {{address}}। नक्शा: {{map}}। RERA नं. {{rera}}। संदेश बंद करने के लिए STOP लिखें।",
  },
  {
    id: "visit_reminder_1d_gu",
    name: "visit_reminder_1d",
    language: "GU",
    body: "નમસ્તે {{name}}, યાદ અપાવીએ કે {{project}} ખાતે આપની સાઇટ વિઝિટ આવતીકાલે, {{time}} છે. સરનામું: {{address}}. નકશો: {{map}}. RERA નં. {{rera}}. સંદેશા બંધ કરવા STOP લખો.",
  },
  {
    id: "visit_reminder_2h_en",
    name: "visit_reminder_2h",
    language: "EN",
    body: "Hello {{name}}, we look forward to seeing you at {{project}} today at {{time}}. Address: {{address}}. Map: {{map}}. RERA No. {{rera}}. Reply STOP to opt out.",
  },
  {
    id: "visit_reminder_2h_hi",
    name: "visit_reminder_2h",
    language: "HI",
    body: "नमस्ते {{name}}, आज {{time}} बजे {{project}} पर आपका इंतज़ार रहेगा। पता: {{address}}। नक्शा: {{map}}। RERA नं. {{rera}}। संदेश बंद करने के लिए STOP लिखें।",
  },
  {
    id: "visit_reminder_2h_gu",
    name: "visit_reminder_2h",
    language: "GU",
    body: "નમસ્તે {{name}}, આજે {{time}} વાગ્યે {{project}} ખાતે આપની રાહ જોઈશું. સરનામું: {{address}}. નકશો: {{map}}. RERA નં. {{rera}}. સંદેશા બંધ કરવા STOP લખો.",
  },
];

export type TemplateVars = { name: string; project: string; time: string; address: string; map: string; rera: string };

export class TemplateError extends Error {}

export function renderTemplate(body: string, vars: TemplateVars, requiresRera: boolean): string {
  const out = body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = (vars as Record<string, string>)[key];
    if (!v) throw new TemplateError(`Missing template variable "${key}"`);
    return v;
  });
  if (requiresRera && !out.includes(vars.rera)) throw new TemplateError("Template must include the RERA number");
  return out;
}
