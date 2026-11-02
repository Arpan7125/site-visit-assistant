"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { ImportSummary } from "@/lib/leads/csv";

/** Portal CSV import. Rejected rows are listed with line and reason, never dropped silently. */
export function ImportPanel() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch("/api/admin/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload aria-hidden size={16} /> Import portal CSV
      </Button>
    );
  }
  return (
    <section aria-label="Import leads" className="w-full rounded-lg border border-line bg-surface p-4 sm:max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">Import a portal export</p>
          <p className="text-sm text-muted">
            Columns: name, phone, source, project, bhk, budget_min_lakh, budget_max_lakh, created_at. Name and source are required.
            Every row gets the same duplicate check as chat leads. Consent is not assumed.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink">Close</button>
      </div>
      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-medium hover:border-ink">
        {busy ? "Importing…" : "Choose CSV file"}
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {result && (
        <div className="mt-4 space-y-2 text-sm" role="status">
          <p>
            <strong>{result.created}</strong> imported, of which {result.duplicates} linked to an existing lead and {result.possibleDuplicates} flagged as possible duplicates.
            {result.errors.length > 0 && <> <strong className="text-danger">{result.errors.length}</strong> rows not imported:</>}
          </p>
          {result.errors.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded border border-line">
              {result.errors.map((e, i) => (
                <li key={i} className="border-b border-line px-3 py-1.5 last:border-0">
                  Line {e.row}, {e.field}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
