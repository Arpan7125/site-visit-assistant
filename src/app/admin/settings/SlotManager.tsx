"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, inputClass } from "@/components/ui";

type Slot = { id: string; startsAt: string; label: string; day: string; isActive: boolean; past: boolean; booking: { leadId: string; name: string } | null };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function post(body: unknown) {
  const res = await fetch("/api/admin/slots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export function SlotManager({ projects, projectId, today, slots }: { projects: { id: string; name: string }[]; projectId: string; today: string; slots: Slot[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [pattern, setPattern] = useState({ fromDate: today, days: 14, weekdays: [0, 2, 3, 4, 5, 6], startHour: 10, endHour: 17, minutes: 60 });
  const [single, setSingle] = useState({ date: today, time: "18:00", minutes: 60 });

  const days = new Map<string, Slot[]>();
  for (const s of slots) days.set(s.day, [...(days.get(s.day) ?? []), s]);

  function run(body: unknown, done: (data: Record<string, unknown>) => string) {
    setMsg(null);
    start(async () => {
      const r = await post(body);
      if (r.ok) {
        setMsg({ tone: "ok", text: done(r.data) });
        router.refresh();
      } else setMsg({ tone: "error", text: String(r.data.error ?? "That didn't work") });
    });
  }

  function toggle(s: Slot) {
    if (s.isActive && s.booking) {
      const ok = window.confirm(`${s.booking.name} is booked at ${s.label}. Disabling cancels their visit and reminders. Continue?`);
      if (!ok) return;
      return run({ action: "toggle", slotId: s.id, active: false, cancelBooked: true }, () => `Slot disabled and ${s.booking!.name}'s visit cancelled. Call them to rebook.`);
    }
    run({ action: "toggle", slotId: s.id, active: !s.isActive }, () => (s.isActive ? "Slot disabled." : "Slot enabled."));
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Project" className="flex gap-2">
        {projects.map((p) => (
          <Link key={p.id} href={`?tab=slots&project=${p.id}`} aria-current={p.id === projectId ? "page" : undefined} className={clsx("rounded-md px-3 py-1.5 text-sm", p.id === projectId ? "bg-ink text-paper" : "border border-line-strong text-muted hover:text-ink")}>
            {p.name}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="space-y-3 rounded-lg border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: "generate", pattern: { projectId, ...pattern } }, (d) => `${d.created} new slots added (${Number(d.requested) - Number(d.created)} already existed).`);
          }}
        >
          <p className="font-medium">Add slots by weekly pattern</p>
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Days of the week</legend>
            {WEEKDAYS.map((d, i) => (
              <label key={d} className={clsx("cursor-pointer rounded-md border px-2.5 py-1.5 text-sm", pattern.weekdays.includes(i) ? "border-accent bg-accent-soft" : "border-line-strong text-muted")}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={pattern.weekdays.includes(i)}
                  onChange={(e) => setPattern((p) => ({ ...p, weekdays: e.target.checked ? [...p.weekdays, i] : p.weekdays.filter((x) => x !== i) }))}
                />
                {d}
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-sm">From<input type="date" value={pattern.fromDate} min={today} onChange={(e) => setPattern((p) => ({ ...p, fromDate: e.target.value }))} className={inputClass} /></label>
            <label className="text-sm">Days<input type="number" min={1} max={60} value={pattern.days} onChange={(e) => setPattern((p) => ({ ...p, days: Number(e.target.value) }))} className={inputClass} /></label>
            <label className="text-sm">Start hour<input type="number" min={6} max={21} value={pattern.startHour} onChange={(e) => setPattern((p) => ({ ...p, startHour: Number(e.target.value) }))} className={inputClass} /></label>
            <label className="text-sm">End hour<input type="number" min={7} max={22} value={pattern.endHour} onChange={(e) => setPattern((p) => ({ ...p, endHour: Number(e.target.value) }))} className={inputClass} /></label>
          </div>
          <label className="block text-sm">
            Slot length
            <select value={pattern.minutes} onChange={(e) => setPattern((p) => ({ ...p, minutes: Number(e.target.value) }))} className={inputClass}>
              {[30, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
          <Button type="submit" disabled={pending}>Add slots</Button>
        </form>

        <form
          className="space-y-3 rounded-lg border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: "add", projectId, ...single }, () => "Slot added.");
          }}
        >
          <p className="font-medium">Add one slot</p>
          <p className="text-sm text-muted">For an evening or holiday visit outside the usual pattern.</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm">Date<input type="date" min={today} value={single.date} onChange={(e) => setSingle((s) => ({ ...s, date: e.target.value }))} className={inputClass} /></label>
            <label className="text-sm">Time (IST)<input type="time" value={single.time} onChange={(e) => setSingle((s) => ({ ...s, time: e.target.value }))} className={inputClass} /></label>
            <label className="text-sm">Minutes<input type="number" min={30} max={180} step={30} value={single.minutes} onChange={(e) => setSingle((s) => ({ ...s, minutes: Number(e.target.value) }))} className={inputClass} /></label>
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>Add slot</Button>
        </form>
      </div>

      {msg && <p role="status" className={msg.tone === "ok" ? "text-accent" : "text-danger"}>{msg.text}</p>}

      <section aria-label="Upcoming slots" className="space-y-4">
        <p className="text-sm text-muted">Click a time to disable it (buyers stop seeing it) or enable it again. Booked times show the buyer&apos;s name.</p>
        {[...days.entries()].map(([day, list]) => (
          <div key={day}>
            <p className="mb-2 text-sm font-medium">{list[0].label.split(",").slice(0, 2).join(",")}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={pending || s.past}
                  onClick={() => toggle(s)}
                  aria-label={`${s.label}, ${s.past ? "past" : s.booking ? `booked by ${s.booking.name}` : s.isActive ? "free, click to disable" : "disabled, click to enable"}`}
                  className={clsx(
                    "min-h-11 rounded-md border px-3 py-1 text-left text-sm",
                    s.past && "border-line text-muted/60",
                    !s.past && s.booking && "border-accent bg-accent-soft",
                    !s.past && !s.booking && s.isActive && "border-line-strong hover:border-ink",
                    !s.past && !s.isActive && "border-dashed border-line-strong text-muted line-through",
                  )}
                >
                  {s.label.split(",").slice(2).join(",").trim()}
                  {s.booking && <span className="block text-xs text-accent-strong">{s.booking.name}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
