import type { Metadata } from "next";
import Link from "next/link";
import { Chip, EmptyState } from "@/components/ui";
import { requireStaff } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { DAY, formatDateTime, istDateKey } from "@/lib/time";
import { FactEditor } from "./FactEditor";
import { SlotManager } from "./SlotManager";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "facts", label: "Fact sheet" },
  { key: "slots", label: "Visit slots" },
  { key: "messages", label: "Message log" },
] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; project?: string }> }) {
  await requireStaff("SALES_HEAD");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "facts";
  const projects = await prisma.project.findMany({ orderBy: { id: "asc" } });
  const projectId = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Settings</h1>
      <nav aria-label="Settings sections" className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "facts" && <Facts projects={projects} />}
      {tab === "slots" && projectId && <Slots projects={projects} projectId={projectId} />}
      {tab === "messages" && <Messages />}
    </div>
  );
}

async function Facts({ projects }: { projects: { id: string; name: string }[] }) {
  const facts = await prisma.factSheetEntry.findMany({ orderBy: [{ projectId: "asc" }, { category: "asc" }, { key: "asc" }] });
  return (
    <FactEditor
      projects={projects}
      facts={facts.map((f) => ({ ...f, updatedAt: f.updatedAt.toISOString(), createdAt: f.createdAt.toISOString() }))}
    />
  );
}

async function Slots({ projects, projectId }: { projects: { id: string; name: string }[]; projectId: string }) {
  const now = new Date();
  const slots = await prisma.visitSlot.findMany({
    where: { projectId, startsAt: { gte: new Date(now.getTime() - DAY), lt: new Date(now.getTime() + 21 * DAY) } },
    orderBy: { startsAt: "asc" },
    include: { visits: { where: { status: "BOOKED" }, include: { lead: { select: { id: true, name: true } } } } },
  });
  return (
    <SlotManager
      projects={projects}
      projectId={projectId}
      today={istDateKey(now)}
      slots={slots.map((s) => ({
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        label: formatDateTime(s.startsAt),
        day: istDateKey(s.startsAt),
        isActive: s.isActive,
        past: s.startsAt <= now,
        booking: s.visits[0] ? { leadId: s.visits[0].lead.id, name: s.visits[0].lead.name } : null,
      }))}
    />
  );
}

const REMINDER_TONE = { SENT: "accent", PENDING: "neutral", CANCELLED: "neutral", SKIPPED_NO_CONSENT: "warn", SKIPPED_OPTED_OUT: "danger" } as const;

async function Messages() {
  const include = { visit: { include: { lead: { select: { id: true, name: true } }, slot: { include: { project: true } } } } } as const;
  const [done, scheduled] = await Promise.all([
    prisma.reminderOutbox.findMany({ where: { status: { not: "PENDING" } }, orderBy: { sendAt: "desc" }, take: 40, include }),
    prisma.reminderOutbox.findMany({ where: { status: "PENDING" }, orderBy: { sendAt: "asc" }, take: 40, include }),
  ]);
  if (!done.length && !scheduled.length) return <EmptyState title="No messages yet">Reminders appear here once a visit is booked: one a day before and one 2 hours before.</EmptyState>;
  return (
    <div className="space-y-8">
      <p className="text-muted">
        Outbound WhatsApp is mocked: approved templates are rendered and recorded here instead of being sent. The cron job sends due reminders every 15 minutes and re-checks consent and opt-out at send time.
      </p>
      <MessageList title="Sent and skipped" rows={done} />
      <MessageList title="Scheduled" rows={scheduled} />
    </div>
  );
}

type OutboxRow = Awaited<ReturnType<typeof prisma.reminderOutbox.findMany<{ include: { visit: { include: { lead: { select: { id: true; name: true } }; slot: { include: { project: true } } } } } }>>>[number];

function MessageList({ title, rows }: { title: string; rows: OutboxRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl">{title}</h2>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
            <div className="text-sm">
              <p className="font-medium">{formatDateTime(r.sentAt ?? r.sendAt)}</p>
              <p className="text-muted">{r.kind === "T_MINUS_1D" ? "Day before" : "2 hours before"}, mock WhatsApp</p>
              <Chip tone={REMINDER_TONE[r.status]} className="mt-1">{r.status.replaceAll("_", " ").toLowerCase()}</Chip>
            </div>
            <div className="text-sm">
              <p>
                To <Link href={`/admin/leads/${r.visit.lead.id}`} className="text-accent underline">{r.visit.lead.name}</Link>, visit {formatDateTime(r.visit.slot.startsAt)} at {r.visit.slot.project.name}
              </p>
              {r.body ? <p className="mt-1 rounded-md bg-paper px-3 py-2">{r.body}</p> : <p className="mt-1 text-muted">{r.status === "PENDING" ? "Will be rendered when sent." : "Not sent."}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
