"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STATUS_LABEL } from "@/components/admin/labels";
import { Button, inputClass } from "@/components/ui";

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function PhoneReveal({ url, masked }: { url: string; masked: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (phone) return <a href={`tel:${phone}`} className="font-medium text-accent underline">{phone}</a>;
  return (
    <span className="inline-flex items-center gap-2">
      {masked}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setPhone(((await post(url, { action: "reveal" })).data.phone as string) ?? null))}
        className="text-sm text-accent underline underline-offset-4"
      >
        Show number
      </button>
      <span className="text-xs text-muted">(logged)</span>
    </span>
  );
}

export function LeadForm(p: {
  url: string;
  editable: boolean;
  isHead: boolean;
  status: string;
  notes: string;
  assignedExecId: string;
  execs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(p.status);
  const [notes, setNotes] = useState(p.notes);
  const [exec, setExec] = useState(p.assignedExecId);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = status !== p.status || notes !== p.notes || exec !== p.assignedExecId;

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await post(p.url, {
            action: "update",
            ...(status !== p.status ? { status } : {}),
            ...(notes !== p.notes ? { notes } : {}),
            ...(p.isHead && exec && exec !== p.assignedExecId ? { assignedExecId: exec } : {}),
          });
          setMsg(r.ok ? "Saved." : String(r.data.error ?? "Couldn't save."));
          if (r.ok) router.refresh();
        });
      }}
    >
      <fieldset disabled={!p.editable} className="space-y-3 disabled:opacity-70">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Executive</span>
            <select value={exec} onChange={(e) => setExec(e.target.value)} disabled={!p.isHead} className={inputClass}>
              <option value="">Unassigned</option>
              {p.execs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="block font-medium">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={inputClass} placeholder="What the buyer told you on the call" />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || pending}>Save changes</Button>
          {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
        </div>
      </fieldset>
    </form>
  );
}

export function SummaryEditor({ url, handoffId, summary, edited, editable }: { url: string; handoffId: string; summary: string; edited: boolean; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(summary);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="rounded-md bg-paper p-3 text-sm">
        <p className="whitespace-pre-line">{summary}</p>
        <p className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{edited ? "Edited by the team" : "Written by the assistant"}</span>
          {editable && <button type="button" className="text-accent underline underline-offset-4" onClick={() => setEditing(true)}>Edit summary</button>}
        </p>
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await post(url, { action: "summary", handoffId, summary: value });
          if (!r.ok) return setError("Couldn't save the summary.");
          setEditing(false);
          router.refresh();
        });
      }}
    >
      <label htmlFor={`sum-${handoffId}`} className="sr-only">Handoff summary</label>
      <textarea id={`sum-${handoffId}`} value={value} onChange={(e) => setValue(e.target.value)} rows={8} className={inputClass} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || value.trim().length < 5}>Save summary</Button>
        <Button type="button" variant="quiet" onClick={() => { setValue(summary); setEditing(false); }}>Cancel</Button>
      </div>
    </form>
  );
}
