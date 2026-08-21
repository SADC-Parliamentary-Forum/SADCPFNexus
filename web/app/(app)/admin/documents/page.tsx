"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { useEffect, useState } from "react";
import Link from "next/link";
import { documentServiceApi, type ManagedDocumentRow } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function AdminDocumentsPage() {
  const { success, error, info } = useToast();
  const [rows, setRows] = useState<ManagedDocumentRow[]>([]);
  const [meta, setMeta] = useState<{ current_page?: number; last_page?: number; total?: number }>({});
  const [q, setQ] = useState("");
  const [module, setModule] = useState("");
  const [holdOnly, setHoldOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [backup, setBackup] = useState<unknown>(null);
  const [retentionForm, setRetentionForm] = useState({ id: "", retain_until: "", retention_policy: "" });

  const load = () => {
    setLoading(true);
    documentServiceApi
      .list({
        q: q || undefined,
        module: module || undefined,
        legal_hold: holdOnly ? true : undefined,
        page,
        per_page: 25,
      })
      .then((r: any) => {
        setRows(r.data?.data ?? r.data ?? []);
        setMeta({
          current_page: r.data?.current_page ?? r.current_page,
          last_page: r.data?.last_page ?? r.last_page,
          total: r.data?.total ?? r.total,
        });
      })
      .catch(() => error("Could not load document register"))
      .finally(() => setLoading(false));
    documentServiceApi
      .backupStatus()
      .then((r: { data?: unknown }) => setBackup((r.data as { data?: unknown })?.data ?? r.data))
      .catch(() => setBackup({ status: "unavailable", note: "Backup status could not be loaded." }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, holdOnly]);

  const placeHold = async (id: number) => {
    const reason = window.prompt("Legal hold reason (required):");
    if (!reason) return;
    try {
      await documentServiceApi.placeLegalHold(id, reason);
      success("Legal hold placed");
      load();
    } catch {
      error("Failed to place hold");
    }
  };

  const releaseHold = async (id: number) => {
    try {
      await documentServiceApi.releaseLegalHold(id);
      success("Legal hold released");
      load();
    } catch {
      error("Failed to release hold");
    }
  };

  const saveRetention = async () => {
    const id = Number(retentionForm.id);
    if (!id || (!retentionForm.retain_until.trim() && !retentionForm.retention_policy.trim())) return;
    try {
      await documentServiceApi.setRetention(id, {
        retain_until: retentionForm.retain_until || undefined,
        retention_policy: retentionForm.retention_policy || undefined,
      });
      success("Retention updated");
      setRetentionForm({ id: "", retain_until: "", retention_policy: "" });
      load();
    } catch {
      error("Failed to set retention");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Document register"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Document register" }]} />}
      />
        <div className="flex gap-3 text-sm">
          <Link href="/admin/documents/governance" className="text-primary underline">
            Governance checklist
          </Link>
          <Link href="/admin/documents/retention" className="text-primary underline">
            Retention dashboard
          </Link>
        </div>
      </div>
<div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Search</label>
          <input
            className="form-input text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, hash, filename…"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Module</label>
          <input
            className="form-input text-sm"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            placeholder="pif, audit…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input type="checkbox" checked={holdOnly} onChange={(e) => setHoldOnly(e.target.checked)} />
          Legal hold only
        </label>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          Apply
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-neutral-200">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Module</th>
                <th className="py-2 pr-3">Class</th>
                <th className="py-2 pr-3">Hash</th>
                <th className="py-2 pr-3">Scan</th>
                <th className="py-2 pr-3">Hold</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-3">{row.id}</td>
                  <td className="py-2 pr-3">{row.title}</td>
                  <td className="py-2 pr-3">{row.module}</td>
                  <td className="py-2 pr-3">{row.classification}</td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {(row.current_version?.content_hash ?? "").slice(0, 12)}…
                  </td>
                  <td className="py-2 pr-3">{row.current_version?.quarantine_status ?? "—"}</td>
                  <td className="py-2 pr-3">{row.legal_hold ? "Yes" : "No"}</td>
                  <td className="py-2 space-x-2">
                    {row.legal_hold ? (
                      <button type="button" className="text-primary underline" onClick={() => releaseHold(row.id)}>
                        Release hold
                      </button>
                    ) : (
                      <button type="button" className="text-primary underline" onClick={() => placeHold(row.id)}>
                        Place hold
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-neutral-500">
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3 text-sm text-neutral-600">
        <span>
          Page {meta.current_page ?? page} / {meta.last_page ?? 1} · {meta.total ?? 0} total
        </span>
        <button
          type="button"
          className="underline"
          disabled={(meta.current_page ?? 1) <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <button
          type="button"
          className="underline"
          disabled={(meta.current_page ?? 1) >= (meta.last_page ?? 1)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {backup != null ? (
        <FormSection title="Backup status" description="Operator backup evidence. This does not invent a completed restore drill." icon="backup">
          <LabelledRecord value={backup} />
        </FormSection>
      ) : null}

      <FormSection
        title="Set retention"
        description="Updates retain-until / policy for one document. It does not dispose records."
        icon="policy"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Document ID" htmlFor="doc-retention-id" required>
            <input
              id="doc-retention-id"
              className="form-input"
              value={retentionForm.id}
              onChange={(e) => setRetentionForm((f) => ({ ...f, id: e.target.value }))}
            />
          </FormField>
          <FormField label="Retain until" htmlFor="doc-retention-until">
            <input
              id="doc-retention-until"
              type="date"
              className="form-input"
              value={retentionForm.retain_until}
              onChange={(e) => setRetentionForm((f) => ({ ...f, retain_until: e.target.value }))}
            />
          </FormField>
          <FormField label="Policy" htmlFor="doc-retention-policy">
            <input
              id="doc-retention-policy"
              className="form-input"
              value={retentionForm.retention_policy}
              onChange={(e) => setRetentionForm((f) => ({ ...f, retention_policy: e.target.value }))}
            />
          </FormField>
        </div>
        <button
          type="button"
          className="btn-primary mt-3 text-sm disabled:opacity-60"
          disabled={!retentionForm.id.trim() || (!retentionForm.retain_until.trim() && !retentionForm.retention_policy.trim())}
          onClick={() => void saveRetention()}
        >
          Save retention
        </button>
      </FormSection>
    </div>
  );
}
