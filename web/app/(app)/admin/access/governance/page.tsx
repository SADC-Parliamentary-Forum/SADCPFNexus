"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Decision = { id: number; topic: string; status: string; decision_notes?: string };

export default function GovernanceChecklistPage() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { status: string; decision_notes: string }>>({});

  const load = () => {
    setLoading(true);
    api
      .get<{ data: Decision[] }>("/admin/access/governance")
      .then((r) => r.data)
      .then((r) => {
        const list = r.data ?? [];
        setRows(list);
        const next: Record<number, { status: string; decision_notes: string }> = {};
        for (const row of list) {
          next[row.id] = { status: row.status, decision_notes: row.decision_notes ?? "" };
        }
        setDrafts(next);
      })
      .catch(() => setError("Failed to load governance checklist."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setError(null);
    try {
      await api.put(`/admin/access/governance/${id}`, {
        status: draft.status,
        decision_notes: draft.decision_notes,
      });
      load();
    } catch {
      setError("Unable to save this governance decision.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Governance checklist"
        subtitle="Institutional decisions (MFA policy, review cadence, break-glass). Status and notes are recorded here; live secrets stay in operator env."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Access", href: "/admin/access" },
              { label: "Governance" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="policy" title="No governance items" description="Checklist topics will appear once seeded by administrators." />
        </div>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {rows.map((r) => {
            const draft = drafts[r.id] ?? { status: r.status, decision_notes: r.decision_notes ?? "" };
            return (
              <div key={r.id} className="space-y-3 px-4 py-4">
                <p className="text-sm font-medium text-neutral-900">{r.topic}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-neutral-600">
                    Status
                    <select
                      className="form-input mt-1 block min-w-[10rem]"
                      value={draft.status}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...draft, status: e.target.value },
                        }))
                      }
                    >
                      <option value="pending">pending</option>
                      <option value="decided">decided</option>
                      <option value="not_applicable">not_applicable</option>
                    </select>
                  </label>
                  <label className="min-w-[16rem] flex-1 text-xs text-neutral-600">
                    Decision notes
                    <textarea
                      className="form-input mt-1 block w-full"
                      rows={2}
                      value={draft.decision_notes}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...draft, decision_notes: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={savingId === r.id}
                    onClick={() => save(r.id)}
                  >
                    {savingId === r.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
