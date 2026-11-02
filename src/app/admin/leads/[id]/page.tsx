import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceTags, StatusChip, VISIT_LABEL } from "@/components/admin/labels";
import { PostButton } from "@/components/admin/PostButton";
import { Chip, EmptyState } from "@/components/ui";
import { requireStaff, canEditLead } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { REASON_LABEL } from "@/lib/handoff/summary";
import { maskPhone } from "@/lib/leads/phone";
import { formatDateTime, formatDuration } from "@/lib/time";
import { LeadForm, PhoneReveal, SummaryEditor } from "./LeadControls";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      project: true,
      assignedExec: true,
      duplicateOf: { select: { id: true, name: true } },
      duplicates: { select: { id: true, name: true, source: true } },
      visits: { include: { slot: { include: { project: true } } }, orderBy: { createdAt: "desc" } },
      handoffs: { include: { executive: true }, orderBy: { createdAt: "desc" } },
      sessions: { include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { startedAt: "desc" } },
    },
  });
  if (!lead) notFound();
  if (lead.deletedAt) {
    return <EmptyState title="This lead's personal data was deleted on request">The anonymous record is kept so totals stay correct.</EmptyState>;
  }
  const [execs, activity] = await Promise.all([
    prisma.user.findMany({ where: { role: "EXECUTIVE", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.activityLog.findMany({ where: { entityId: { in: [lead.id, ...lead.visits.map((v) => v.id)] } }, orderBy: { createdAt: "desc" }, take: 15, include: { actor: true } }),
  ]);
  const editable = canEditLead(staff, lead);
  const isHead = staff.role === "SALES_HEAD";
  const api = `/api/admin/leads/${lead.id}`;
  const openHandoff = lead.handoffs.find((h) => !h.acknowledgedAt);
  const reply = lead.firstResponseAt ? lead.firstResponseAt.getTime() - lead.firstContactAt.getTime() : null;
  const now = new Date();

  return (
    <div className="space-y-6">
      <Link href="/admin/leads" className="text-sm text-accent underline-offset-4 hover:underline">All leads</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">{lead.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
            {lead.id} <StatusChip status={lead.status} /> <SourceTags source={lead.source} extra={lead.extraSources} />
            {lead.optedOut && <Chip tone="danger">Opted out of contact</Chip>}
          </p>
        </div>
        {!editable && <p className="max-w-xs text-sm text-muted">Assigned to {lead.assignedExec?.name ?? "nobody"}. You can view this lead but only they or the sales head can change it.</p>}
      </header>

      {lead.duplicateState === "POSSIBLE" && lead.duplicateOf && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3">
          <p className="text-warn">
            Possible duplicate of <Link className="font-medium underline" href={`/admin/leads/${lead.duplicateOf.id}`}>{lead.duplicateOf.name} ({lead.duplicateOf.id})</Link>: similar name on the same project, different phone.
          </p>
          {isHead ? (
            <span className="flex gap-2">
              <PostButton url={api} body={{ action: "duplicate", decision: "merge" }}>Same person, merge</PostButton>
              <PostButton url={api} body={{ action: "duplicate", decision: "dismiss" }} variant="quiet">Different people</PostButton>
            </span>
          ) : (
            <span className="text-sm text-warn">The sales head reviews duplicates.</span>
          )}
        </section>
      )}
      {lead.duplicateState === "CONFIRMED" && lead.duplicateOf && (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-muted">
          Same phone as <Link className="text-accent underline" href={`/admin/leads/${lead.duplicateOf.id}`}>{lead.duplicateOf.name} ({lead.duplicateOf.id})</Link>. Work the original lead; this record keeps the extra source.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <section aria-labelledby="profile" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="profile" className="font-display text-xl">Profile</h2>
            <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted">Phone</dt>
              <dd>{lead.phoneE164 ? <PhoneReveal url={api} masked={maskPhone(lead.phoneE164)} /> : "Not shared"}</dd>
              <dt className="text-muted">Consent</dt>
              <dd>{lead.consentContact ? `Given ${lead.consentAt ? formatDateTime(lead.consentAt) : ""}` : lead.optedOut ? `Opted out ${lead.optedOutAt ? formatDateTime(lead.optedOutAt) : ""}` : "Not given: do not call or message"}</dd>
              <dt className="text-muted">Project</dt>
              <dd>{lead.project?.name ?? "Not decided"}</dd>
              <dt className="text-muted">Wants</dt>
              <dd>{lead.wantsBhk ? `${lead.wantsBhk} BHK` : "—"}</dd>
              <dt className="text-muted">Budget</dt>
              <dd>{lead.budgetMinLakh || lead.budgetMaxLakh ? `₹${lead.budgetMinLakh ?? "?"}–${lead.budgetMaxLakh ?? "?"} lakh (stated by buyer)` : "—"}</dd>
              <dt className="text-muted">Timeline</dt>
              <dd>{lead.timeline ?? "—"}</dd>
              <dt className="text-muted">Language</dt>
              <dd>{{ EN: "English", HI: "Hindi", GU: "Gujarati" }[lead.language]}</dd>
              <dt className="text-muted">First reply</dt>
              <dd>{reply === null ? <Chip tone="danger">Not reached</Chip> : `${formatDuration(reply)} after enquiry`}</dd>
              <dt className="text-muted">Enquired</dt>
              <dd>{formatDateTime(lead.firstContactAt)}</dd>
              {lead.duplicates.length > 0 && (
                <>
                  <dt className="text-muted">Also came via</dt>
                  <dd className="space-y-1">{lead.duplicates.map((d) => <Link key={d.id} href={`/admin/leads/${d.id}`} className="block text-accent underline">{d.id} ({d.name})</Link>)}</dd>
                </>
              )}
            </dl>
          </section>

          <section aria-labelledby="work" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="work" className="font-display text-xl">Status and notes</h2>
            <LeadForm url={api} editable={editable} isHead={isHead} status={lead.status} notes={lead.notes ?? ""} assignedExecId={lead.assignedExecId ?? ""} execs={execs} />
          </section>

          <section aria-labelledby="visits" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="visits" className="font-display text-xl">Site visits</h2>
            {lead.visits.length === 0 ? (
              <p className="mt-2 text-muted">No visit booked yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {lead.visits.map((v) => {
                  const past = v.slot.startsAt <= now;
                  return (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{formatDateTime(v.slot.startsAt)}</p>
                        <p className="text-sm text-muted">{v.slot.project.name}</p>
                      </div>
                      <span className="flex flex-wrap items-center gap-2">
                        <Chip tone={v.status === "COMPLETED" ? "accent" : v.status === "NO_SHOW" ? "danger" : "neutral"}>{VISIT_LABEL[v.status]}</Chip>
                        {editable && past && v.status === "BOOKED" && (
                          <>
                            <PostButton url={api} body={{ action: "outcome", visitId: v.id, outcome: "COMPLETED" }} variant="primary">They came</PostButton>
                            <PostButton url={api} body={{ action: "outcome", visitId: v.id, outcome: "NO_SHOW" }}>No-show</PostButton>
                          </>
                        )}
                        {v.status === "BOOKED" && !past && <span className="text-sm text-muted">Outcome can be logged after the visit</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {isHead && (
            <section aria-labelledby="privacy" className="rounded-lg border border-line p-5">
              <h2 id="privacy" className="font-display text-xl">Delete personal data</h2>
              <p className="mt-1 text-sm text-muted">For a buyer&apos;s erasure request (DPDP Act). Removes name, phone, email, notes and chat text; cancels upcoming visits and reminders. Totals stay correct. This cannot be undone.</p>
              <div className="mt-3">
                <PostButton url={api} body={{ action: "erase", confirm: "DELETE" }} variant="danger" confirm={`Delete all personal data for ${lead.name}? This cannot be undone.`}>
                  Delete this buyer&apos;s data
                </PostButton>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section aria-labelledby="handoff" className="rounded-lg border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="handoff" className="font-display text-xl">Handoff</h2>
              {openHandoff && editable && (
                <PostButton url={api} body={{ action: "ack", handoffId: openHandoff.id }} variant="primary">I&apos;ve got this</PostButton>
              )}
            </div>
            {lead.handoffs.length === 0 ? (
              <p className="mt-2 text-muted">The assistant is still handling this buyer. It hands off when the buyer is serious, asks for a person, asks about price, or asks something the fact sheet doesn&apos;t cover.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {lead.handoffs.map((h) => (
                  <article key={h.id} className="space-y-2">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <strong>{h.executive.name}</strong>
                      <Chip tone={h.acknowledgedAt ? "neutral" : "accent"}>{h.acknowledgedAt ? `Picked up ${formatDateTime(h.acknowledgedAt)}` : "Waiting"}</Chip>
                      <span className="text-muted">{REASON_LABEL[h.reason] ?? h.reason}, {formatDateTime(h.createdAt)}</span>
                    </p>
                    <SummaryEditor url={api} handoffId={h.id} summary={h.summary} edited={h.summaryEdited} editable={editable} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="transcript" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="transcript" className="font-display text-xl">Chat transcript</h2>
            {lead.sessions.length === 0 ? (
              <p className="mt-2 text-muted">No web chat for this lead. It came in through {lead.source === "HOARDING_CALL" ? "a phone call" : "an import or another channel"}.</p>
            ) : (
              lead.sessions.map((s) => (
                <div key={s.id} className="mt-3">
                  {s.flagged && (
                    <p className="mb-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
                      Flagged: {s.flagReason}{s.reviewedAt ? `, reviewed ${formatDateTime(s.reviewedAt)}` : ", awaiting the sales head's review"}
                    </p>
                  )}
                  <ol className="space-y-3 text-sm">
                    {s.messages.filter((m) => m.role !== "SYSTEM").map((m) => {
                      const verdict = m.guardVerdict?.startsWith("{") ? (JSON.parse(m.guardVerdict) as { verdict: string; blockedText?: string }) : null;
                      return (
                        <li key={m.id} className={m.role === "BUYER" ? "ml-8 rounded-md bg-accent-soft px-3 py-2" : "mr-8"}>
                          <p className="mb-0.5 text-xs text-muted">
                            {m.role === "BUYER" ? "Buyer" : m.role === "EXECUTIVE" ? "Executive" : "Assistant"}, {formatDateTime(m.createdAt)}
                            {m.groundedFactIds.length > 0 && `, ${m.groundedFactIds.length} fact${m.groundedFactIds.length > 1 ? "s" : ""} used`}
                          </p>
                          <p className="whitespace-pre-line">{m.content}</p>
                          {verdict && verdict.verdict !== "PASS" && verdict.verdict !== "FIXED_TEMPLATE" && (
                            <p className="mt-1 text-xs text-warn">Guard: {verdict.verdict}{verdict.blockedText ? `. Blocked draft: "${verdict.blockedText}"` : ""}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="activity" className="rounded-lg border border-line p-5">
            <h2 id="activity" className="font-display text-xl">Activity</h2>
            {activity.length === 0 ? (
              <p className="mt-2 text-muted">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4">
                    <span>{a.action.replaceAll("_", " ").replace(".", ": ")}{a.actor ? `, by ${a.actor.name}` : ""}</span>
                    <span className="shrink-0 text-muted">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
