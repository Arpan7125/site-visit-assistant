"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, Chip, inputClass } from "@/components/ui";

type Fact = {
  id: string;
  projectId: string | null;
  key: string;
  category: string;
  valueEn: string;
  valueHi: string | null;
  valueGu: string | null;
  quotable: boolean;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
};

const CATEGORIES = ["configuration", "price", "payment", "possession", "location", "amenities", "parking", "approvals", "construction", "water", "security", "visit", "developer", "schools"];

export function FactEditor({ projects, facts }: { projects: { id: string; name: string }[]; facts: Fact[] }) {
  const [scope, setScope] = useState<string>("all");
  const [editing, setEditing] = useState<Fact | "new" | null>(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const shown = useMemo(
    () =>
      facts.filter(
        (f) => (scope === "all" || (scope === "general" ? f.projectId === null : f.projectId === scope)) && (!missingOnly || !f.valueHi || !f.valueGu),
      ),
    [facts, scope, missingOnly],
  );
  const missing = facts.filter((f) => !f.valueHi || !f.valueGu).length;
  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? id : "Both projects");

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-muted">
        The assistant can state only what is written here. If a buyer asks about something not covered, it says a person will confirm and hands the chat to an executive. Prices can be repeated only from entries marked quotable, always as indicative.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="sr-only">Project</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="min-h-11 rounded-md border border-line-strong bg-surface px-3">
            <option value="all">All entries ({facts.length})</option>
            <option value="general">Both projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Missing a translation ({missing})
        </label>
        <Button className="ml-auto" onClick={() => setEditing("new")}>Add entry</Button>
      </div>

      {editing && <FactForm fact={editing === "new" ? null : editing} projects={projects} defaultProject={scope !== "all" && scope !== "general" ? scope : null} onClose={() => setEditing(null)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">Topic</th>
              <th scope="col" className="px-3 py-2.5 font-medium">English (what the assistant reads first)</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Translations</th>
              <th scope="col" className="px-3 py-2.5 font-medium"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.id} className="border-b border-line align-top last:border-0">
                <td className="px-3 py-2.5">
                  <p className="font-medium">{f.key.replaceAll("_", " ")}</p>
                  <p className="text-muted">{projectName(f.projectId)}, {f.category}</p>
                  {f.quotable && <Chip tone="accent" className="mt-1">Quotable price</Chip>}
                </td>
                <td className="px-3 py-2.5">{f.valueEn}<p className="mt-1 text-xs text-muted">v{f.version}{f.updatedBy ? `, ${f.updatedBy}` : ""}</p></td>
                <td className="px-3 py-2.5">
                  <span className="flex gap-1">
                    <Chip tone={f.valueHi ? "neutral" : "warn"}>{f.valueHi ? "हिन्दी" : "No Hindi"}</Chip>
                    <Chip tone={f.valueGu ? "neutral" : "warn"}>{f.valueGu ? "ગુજરાતી" : "No Gujarati"}</Chip>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button type="button" onClick={() => setEditing(f)} className="text-accent underline underline-offset-4">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FactForm({ fact, projects, defaultProject, onClose }: { fact: Fact | null; projects: { id: string; name: string }[]; defaultProject: string | null; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    projectId: fact?.projectId ?? defaultProject,
    key: fact?.key ?? "",
    category: fact?.category ?? "amenities",
    valueEn: fact?.valueEn ?? "",
    valueHi: fact?.valueHi ?? "",
    valueGu: fact?.valueGu ?? "",
    quotable: fact?.quotable ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  async function call(method: "POST" | "DELETE", body: unknown) {
    const res = await fetch("/api/admin/facts", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.issues?.[0]?.message ?? data.error ?? "Couldn't save");
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-accent/30 bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            await call("POST", { ...(fact ? { id: fact.id } : {}), ...v });
            onClose();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save");
          }
        });
      }}
    >
      <p className="font-display text-xl">{fact ? `Edit: ${fact.key.replaceAll("_", " ")}` : "New fact sheet entry"}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Applies to</span>
          <select value={v.projectId ?? ""} onChange={(e) => set({ projectId: e.target.value || null })} className={inputClass}>
            <option value="">Both projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Topic key</span>
          <input value={v.key} onChange={(e) => set({ key: e.target.value })} placeholder="e.g. pet_policy" className={inputClass} required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Category</span>
          <select value={v.category} onChange={(e) => set({ category: e.target.value })} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {(["valueEn", "valueHi", "valueGu"] as const).map((k) => (
        <label key={k} className="block space-y-1 text-sm" lang={k === "valueHi" ? "hi" : k === "valueGu" ? "gu" : "en"}>
          <span className="block font-medium">{{ valueEn: "English (required)", valueHi: "हिन्दी", valueGu: "ગુજરાતી" }[k]}</span>
          <textarea value={v[k]} onChange={(e) => set({ [k]: e.target.value })} rows={2} maxLength={600} className={inputClass} required={k === "valueEn"} />
        </label>
      ))}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={v.quotable} onChange={(e) => set({ quotable: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
        <span>
          <span className="font-medium">Quotable price.</span> Tick only for &quot;starting from&quot; prices the assistant may repeat. They are always shown as indicative, with a note that the team confirms the final price.
        </span>
      </label>
      <div className="rounded-md bg-paper p-3 text-sm">
        <p className="text-muted">How the assistant sees this</p>
        <pre className="mt-1 whitespace-pre-wrap font-sans">{JSON.stringify({ topic: v.key || "…", value: v.valueEn || "…", quotable: v.quotable }, null, 1)}</pre>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{fact ? "Save changes" : "Add entry"}</Button>
        <Button type="button" variant="quiet" onClick={onClose}>Cancel</Button>
        {fact && (
          <Button
            type="button"
            variant="danger"
            className="ml-auto"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${fact.key}"? The assistant will stop answering this topic and hand off instead.`)) return;
              start(async () => {
                try {
                  await call("DELETE", { id: fact.id });
                  onClose();
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn't delete");
                }
              });
            }}
          >
            Delete entry
          </Button>
        )}
      </div>
    </form>
  );
}
