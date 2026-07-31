"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  documentGovernanceApi,
  type DocumentGovernanceDecision,
} from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  decided: "Decided",
  not_applicable: "Not Applicable",
};

export default function DocumentGovernancePage() {
  const [rows, setRows] = useState<DocumentGovernanceDecision[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    documentGovernanceApi
      .list()
      .then((r: any) => {
        setRows(r.data?.data ?? r.data ?? []);
        setMeta(r.data?.meta ?? r.meta ?? {});
      })
      .catch(() => setToast("Could not load governance checklist"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (row: DocumentGovernanceDecision) => {
    setEditing(row.id);
    setStatus(row.status);
    setNotes(row.decision_notes ?? "");
  };

  const save = async (id: number) => {
    setSaving(true);
    try {
      await documentGovernanceApi.update(id, {
        status,
        decision_notes: notes || null,
      });
      setToast("Decision saved");
      setEditing(null);
      load();
    } catch {
      setToast("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Document repository governance"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Document repository governance" }]} />}
      />
        <Link href="/admin/documents" className="text-sm text-primary underline">
          Back to document register
        </Link>
      </div>

      {toast && (
        <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">{toast}</div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="border border-neutral-200 rounded p-4">
              <div className="flex justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-medium">{row.title}</h2>
                  <p className="text-sm text-neutral-600 mt-1">{row.description}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Status: {STATUS_LABELS[row.status] ?? row.status}
                  </p>
                </div>
                <button type="button" className="text-sm text-primary underline" onClick={() => startEdit(row)}>
                  Update
                </button>
              </div>
              {editing === row.id && (
                <div className="mt-3 space-y-2">
                  <select className="form-input text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="decided">Decided</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                  <textarea
                    className="form-input text-sm w-full"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Decision notes (optional)"
                  />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => save(row.id)}>
                      Save
                    </button>
                    <button type="button" className="text-sm underline" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
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
