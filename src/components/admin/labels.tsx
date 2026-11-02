import type { LeadSource, LeadStatus, VisitStatus } from "@prisma/client";
import { Chip } from "@/components/ui";
import { SOURCE_LABEL } from "@/lib/config";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  ENGAGED: "Engaged",
  VISIT_BOOKED: "Visit booked",
  VISITED: "Visited",
  NO_SHOW: "No-show",
  HANDED_OFF: "With executive",
  LOST: "Lost",
};

const STATUS_TONE: Record<LeadStatus, "neutral" | "accent" | "warn" | "danger"> = {
  NEW: "warn",
  ENGAGED: "neutral",
  VISIT_BOOKED: "accent",
  VISITED: "accent",
  NO_SHOW: "danger",
  HANDED_OFF: "neutral",
  LOST: "neutral",
};

export function StatusChip({ status }: { status: LeadStatus }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
}

export const VISIT_LABEL: Record<VisitStatus, string> = { BOOKED: "Booked", CANCELLED: "Cancelled", COMPLETED: "Visited", NO_SHOW: "No-show" };

export function SourceTags({ source, extra }: { source: LeadSource; extra: LeadSource[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Chip>{SOURCE_LABEL[source]}</Chip>
      {extra.map((s) => (
        <Chip key={s} className="opacity-80">
          + {SOURCE_LABEL[s]}
        </Chip>
      ))}
    </span>
  );
}
