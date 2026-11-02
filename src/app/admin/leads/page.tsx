import type { Metadata } from "next";
import Link from "next/link";
import { SourceTags, STATUS_LABEL, StatusChip } from "@/components/admin/labels";
import { Chip, EmptyState, ErrorNote, inputClass } from "@/components/ui";
import { requireStaff } from "@/lib/authz";
import { SOURCE_LABEL, SOURCES } from "@/lib/config";
import { prisma } from "@/lib/db";
import { maskPhone } from "@/lib/leads/phone";
import { leadFilterSchema, listLeads } from "@/lib/leads/list";
import { formatDateTime, formatDuration } from "@/lib/time";
import { ImportPanel } from "./ImportPanel";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff();
  const raw = await searchParams;
  const filters = leadFilterSchema.parse(raw);
  const [{ rows, total, page, pages }, projects, possible, openHandoffs] = await Promise.all([
    listLeads(prisma, filters, staff.id),
    prisma.project.findMany({ orderBy: { id: "asc" } }),
    prisma.lead.count({ where: { duplicateState: "POSSIBLE", deletedAt: null } }),
    prisma.handoff.count({ where: { acknowledgedAt: null, ...(staff.role === "EXECUTIVE" ? { executiveId: staff.id } : {}) } }),
  ]);
  const hasFilters = Object.entries(filters).some(([k, v]) => v !== undefined && k !== "page" && k !== "sort");
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...raw, ...patch })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      {raw.denied && <ErrorNote title="That page is for the sales head only." />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Leads</h1>
          <p className="text-muted">
            {total} {total === 1 ? "lead" : "leads"} from every source, one list.{" "}
            {openHandoffs > 0 && (
              <Link href={qs({ status: "HANDED_OFF", mine: staff.role === "EXECUTIVE" ? "1" : undefined, page: undefined })} className="text-accent underline underline-offset-4">
                {openHandoffs} waiting for {staff.role === "EXECUTIVE" ? "you" : "an executive"}
              </Link>
            )}
          </p>
        </div>
        {staff.role === "SALES_HEAD" && <ImportPanel />}
      </div>

      <form method="get" className="sticky top-[57px] z-10 -mx-4 grid gap-2 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:grid-cols-[2fr_repeat(4,1fr)_auto] sm:px-6">
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={filters.q} placeholder="Name, lead ID or last 4 digits" className={inputClass} />
        <Select name="source" label="Source" value={filters.source} options={SOURCES.map((s) => [s, SOURCE_LABEL[s]])} />
        <Select name="project" label="Project" value={filters.project} options={projects.map((p) => [p.id, p.name])} />
        <Select name="status" label="Status" value={filters.status} options={Object.entries(STATUS_LABEL)} />
        <Select name="dup" label="Duplicates" value={filters.dup} options={[["possible", "Possible duplicates"], ["any", "Any duplicate"]]} />
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-paper">Filter</button>
          {hasFilters && <Link href="/admin/leads" className="inline-flex min-h-11 items-center px-2 text-sm text-accent">Clear</Link>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted sm:col-span-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="mine" value="1" defaultChecked={!!filters.mine} className="h-4 w-4 accent-[var(--color-accent)]" /> Assigned to me
          </label>
          <label className="inline-flex items-center gap-2">From <input type="date" name="from" defaultValue={filters.from} className="rounded border border-line-strong bg-surface px-2 py-1" /></label>
          <label className="inline-flex items-center gap-2">to <input type="date" name="to" defaultValue={filters.to} className="rounded border border-line-strong bg-surface px-2 py-1" /></label>
          <label className="inline-flex items-center gap-2">
            Sort
            <select name="sort" defaultValue={filters.sort ?? "newest"} className="rounded border border-line-strong bg-surface px-2 py-1">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="response">Not yet answered first</option>
              <option value="name">Name</option>
            </select>
          </label>
          {possible > 0 && !filters.dup && (
            <Link href={qs({ dup: "possible", page: undefined })} className="text-warn underline underline-offset-4">
              {possible} possible {possible === 1 ? "duplicate needs" : "duplicates need"} review
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState title="No leads match these filters" action={<Link href="/admin/leads" className="font-medium text-accent underline underline-offset-4">Clear filters</Link>} />
        ) : (
          <EmptyState title="No leads yet">New enquiries from the website chat, portals, ads and the hoarding number will appear here within seconds.</EmptyState>
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[860px] text-left text-sm">
              <caption className="sr-only">Leads, page {page} of {pages}</caption>
              <thead className="border-b border-line text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">Lead</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Source</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Project / wants</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Executive</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">First reply</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const reply = l.firstResponseAt ? l.firstResponseAt.getTime() - l.firstContactAt.getTime() : null;
                  return (
                    <tr key={l.id} className="border-b border-line last:border-0 hover:bg-paper">
                      <td className="px-3 py-2.5">
                        <Link href={`/admin/leads/${l.id}`} className="font-medium hover:text-accent hover:underline">
                          {l.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-muted">
                          <span>{l.id}</span>
                          <span>{maskPhone(l.phoneE164)}</span>
                          {l.duplicateState === "POSSIBLE" && <Chip tone="warn">Possible duplicate</Chip>}
                          {l.duplicateState === "CONFIRMED" && <Chip>Duplicate of {l.duplicateOfId}</Chip>}
                          {l.handoffs.length > 0 && <Chip tone="accent">Handoff open</Chip>}
                          {l.optedOut && <Chip tone="danger">Opted out</Chip>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><SourceTags source={l.source} extra={l.extraSources} /></td>
                      <td className="px-3 py-2.5">
                        {l.project?.name ?? <span className="text-muted">Not decided</span>}
                        <div className="text-muted">{l.wantsBhk ? `${l.wantsBhk} BHK` : "—"}{l.budgetMaxLakh ? `, up to ₹${l.budgetMaxLakh}L` : ""}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusChip status={l.status} />
                        {l.visits[0] && <div className="mt-1 text-muted">{formatDateTime(l.visits[0].slot.startsAt)}</div>}
                      </td>
                      <td className="px-3 py-2.5">{l.assignedExec?.name ?? <span className="text-muted">Unassigned</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {reply === null ? <Chip tone="danger">Not reached</Chip> : <span className={reply > 48 * 3_600_000 ? "text-danger" : ""}>{formatDuration(reply)}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-muted">{formatDateTime(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <span className="text-muted">Page {page} of {pages}</span>
            <span className="flex gap-2">
              {page > 1 && <Link className="rounded-md border border-line-strong px-3 py-2 hover:border-ink" href={qs({ page: page - 1 })}>Previous</Link>}
              {page < pages && <Link className="rounded-md border border-line-strong px-3 py-2 hover:border-ink" href={qs({ page: page + 1 })}>Next</Link>}
            </span>
          </nav>
        </>
      )}
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <>
      <label className="sr-only" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">{label}: all</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </>
  );
}
