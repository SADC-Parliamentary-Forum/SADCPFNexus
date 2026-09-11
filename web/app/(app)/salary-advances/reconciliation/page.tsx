"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { financeApi, type SalaryAdvanceReconciliation } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { formatSaCurrency } from "@/components/salary-advance/AdvanceQueueTable";
import { SalaryAdvancePageHeader } from "@/components/salary-advance/SalaryAdvancePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

export default function ReconciliationQueuePage() {
  const [rows, setRows] = useState<SalaryAdvanceReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("balanced");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await financeApi.listSalaryAdvanceReconciliations({ status: "open", per_page: 50 });
      setRows(getListData<SalaryAdvanceReconciliation>(res.data));
    } catch {
      setError("Failed to load reconciliation queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (row: SalaryAdvanceReconciliation) => {
    if (!notes.trim()) return;
    setBusy(true);
    try {
      await financeApi.resolveSalaryAdvanceReconciliation(row.salary_advance_request_id, row.id, {
        resolution_notes: notes.trim(),
        outcome,
      });
      setResolvingId(null);
      setNotes("");
      await load();
    } catch {
      setError("Failed to resolve reconciliation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <SalaryAdvancePageHeader
        title="Reconciliation Queue"
        subtitle="Open records created when recovery is partial or requires follow-up."
        crumbs={[
          { label: "nav.salary_advances", href: "/salary-advances" },
          { label: "Reconciliation" },
        ]}
      />

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-neutral-100 animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="compare_arrows"
          title="No open reconciliations"
          description="Partial recoveries will appear here automatically."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="card p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-neutral-500">{row.advance?.reference_number ?? `#${row.salary_advance_request_id}`}</p>
                  <p className="text-sm font-semibold text-neutral-900">{row.advance?.requester?.name ?? "Employee"}</p>
                  <p className="text-xs text-neutral-500 mt-1">Opened {row.created_at ? formatDate(row.created_at as unknown as string) : "—"} · Reason: {(row.reason ?? "—").replaceAll("_", " ")}</p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <p>Expected: <span className="font-semibold">{formatSaCurrency(row.expected_amount ?? 0)}</span></p>
                  <p>Recovered: <span className="font-semibold">{formatSaCurrency(row.recovered_amount ?? 0)}</span></p>
                  <p>Variance: <span className="font-semibold text-amber-700">{formatSaCurrency(row.variance_amount ?? 0)}</span></p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/salary-advances/${row.salary_advance_request_id}`} className="btn-secondary py-1.5 px-3 text-xs">Open advance</Link>
                <button type="button" className="btn-primary py-1.5 px-3 text-xs" onClick={() => setResolvingId(row.id)}>
                  Resolve
                </button>
              </div>
              {resolvingId === row.id && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                  <label htmlFor={`salary-advance-recon-outcome-${row.id}`} className="block text-xs font-medium text-neutral-700">
                    Outcome
                    <select id={`salary-advance-recon-outcome-${row.id}`} className="mt-1 input w-full text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                      <option value="balanced">Balanced</option>
                      <option value="adjusted">Adjusted</option>
                      <option value="written_off">Written off</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label htmlFor={`salary-advance-recon-notes-${row.id}`} className="block text-xs font-medium text-neutral-700">
                    Resolution notes
                    <textarea id={`salary-advance-recon-notes-${row.id}`} className="mt-1 input w-full text-sm min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy || !notes.trim()} onClick={() => resolve(row)} className="btn-primary py-1.5 px-3 text-xs disabled:opacity-40">
                      Confirm resolve
                    </button>
                    <button type="button" className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setResolvingId(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
