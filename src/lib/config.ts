import type { LeadSource } from "@prisma/client";

/**
 * Assumption A6: monthly spend per source (₹). The brief gives ₹30 lakh/month in total and
 * ₹1,000 per lead but no split, so this split is invented and labelled as such in the UI.
 */
export const MONTHLY_SPEND_INR: Record<LeadSource, number> = {
  PORTAL: 12_00_000,
  SOCIAL_AD: 9_00_000,
  WEBSITE: 3_00_000,
  HOARDING_CALL: 4_00_000,
  WHATSAPP: 2_00_000,
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  PORTAL: "Property portal",
  SOCIAL_AD: "Social media ad",
  WEBSITE: "Website",
  HOARDING_CALL: "Hoarding call",
  WHATSAPP: "WhatsApp",
};

export const SOURCES = Object.keys(SOURCE_LABEL) as LeadSource[];

/** Brief's success metrics, shown as targets on the dashboard. */
export const TARGETS = { medianFirstResponseMin: 5, notReached48hPct: 5, leadToVisitPct: 8 };
