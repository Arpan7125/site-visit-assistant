import type { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { createLead, LEAD_SOURCES, LeadValidationError, type LeadInput } from "./create";

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const SOURCE_ALIASES: Record<string, (typeof LEAD_SOURCES)[number]> = {
  portal: "PORTAL",
  "property portal": "PORTAL",
  social: "SOCIAL_AD",
  "social media ad": "SOCIAL_AD",
  social_ad: "SOCIAL_AD",
  website: "WEBSITE",
  web: "WEBSITE",
  hoarding: "HOARDING_CALL",
  "hoarding call": "HOARDING_CALL",
  hoarding_call: "HOARDING_CALL",
  whatsapp: "WHATSAPP",
};

export type ImportRowError = { row: number; field: string; message: string };
export type ImportSummary = {
  created: number;
  duplicates: number;
  possibleDuplicates: number;
  errors: ImportRowError[];
  createdIds: string[];
};

export const CSV_COLUMNS = ["name", "phone", "email", "source", "project", "bhk", "budget_min_lakh", "budget_max_lakh"];
const MAX_ROWS = 2000;

/**
 * Import a portal export. Every bad row is reported with its line number and field;
 * good rows go through createLead so they get the same duplicate check as chat leads.
 */
export async function importLeadsCsv(
  db: PrismaClient,
  text: string,
  opts: { actorId: string | null; projectIds: Record<string, string> },
): Promise<ImportSummary> {
  const rows = parseCsv(text);
  const summary: ImportSummary = { created: 0, duplicates: 0, possibleDuplicates: 0, errors: [], createdIds: [] };
  if (!rows.length) {
    summary.errors.push({ row: 1, field: "file", message: "The file is empty" });
    return summary;
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = ["name", "source"].filter((c) => !header.includes(c));
  if (missing.length) {
    summary.errors.push({ row: 1, field: "header", message: `Missing column(s): ${missing.join(", ")}` });
    return summary;
  }
  if (rows.length - 1 > MAX_ROWS) {
    summary.errors.push({ row: 1, field: "file", message: `At most ${MAX_ROWS} rows per import` });
    return summary;
  }
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    const v = i >= 0 ? r[i]?.trim() : "";
    return v ? v : undefined;
  };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const rawSource = col(r, "source")?.toLowerCase() ?? "";
    const source = SOURCE_ALIASES[rawSource] ?? (LEAD_SOURCES as readonly string[]).find((s) => s.toLowerCase() === rawSource);
    if (!source) {
      summary.errors.push({ row: line, field: "source", message: `Unknown source "${col(r, "source") ?? ""}"` });
      continue;
    }
    const projectKey = col(r, "project")?.toLowerCase();
    const projectId = projectKey ? opts.projectIds[projectKey] : undefined;
    if (projectKey && !projectId) {
      summary.errors.push({ row: line, field: "project", message: `Unknown project "${col(r, "project")}"` });
      continue;
    }
    const num = (name: string) => {
      const v = col(r, name);
      return v === undefined ? undefined : Number(v.replace(/[^\d.]/g, ""));
    };
    const input: LeadInput = {
      name: col(r, "name") ?? "",
      phone: col(r, "phone"),
      email: col(r, "email"),
      source: source as LeadInput["source"],
      projectId,
      wantsBhk: num("bhk"),
      budgetMinLakh: num("budget_min_lakh"),
      budgetMaxLakh: num("budget_max_lakh"),
      // Portal exports do not carry DPDP consent; we never assume it.
      consentContact: false,
    };
    try {
      const res = await createLead(db, input, { actorId: opts.actorId });
      summary.created++;
      summary.createdIds.push(res.lead.id);
      if (res.duplicate === "CONFIRMED") summary.duplicates++;
      if (res.duplicate === "POSSIBLE") summary.possibleDuplicates++;
    } catch (err) {
      if (err instanceof LeadValidationError) summary.errors.push({ row: line, field: err.field, message: err.message });
      else if (err instanceof ZodError) {
        for (const issue of err.issues) {
          summary.errors.push({ row: line, field: String(issue.path[0] ?? "row"), message: issue.message });
        }
      } else throw err;
    }
  }
  return summary;
}
