"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  documentGovernanceApi,
  type DocumentGovernanceDecision,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

function statusVariant(status: string): "warning" | "success" | "muted" {
  if (status === "decided") return "success";
  if (status === "pending") return "warning";
  return "muted";
}

export default function DocumentGovernancePage() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const [rows, setRows] = useState<DocumentGovernanceDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);

  const statusLabel = (value: string) => {
    if (value === "pending") return t("documents.governance.pending");
    if (value === "decided") return t("documents.governance.decided");
    if (value === "not_applicable") return t("documents.governance.na");
    return value;
  };

  const load = () => {
    setLoading(true);
    documentGovernanceApi
      .list()
      .then((r) => {
        setRows(r.data?.data ?? []);
      })
      .catch((err: unknown) => {
        setRows([]);
        error(t("documents.governance.loadError"), apiErrorMessage(err, t("documents.governance.loadError")));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (row: DocumentGovernanceDecision) => {
    setEditing(row.id);
    setStatus(row.status);
    setNotes(row.decision_notes ?? "");
  };

  const save = async (id: number) => {
    if (saving) return;
    setSaving(true);
    try {
      await documentGovernanceApi.update(id, {
        status,
        decision_notes: notes.trim() || null,
      });
      success(t("documents.governance.saved"));
      setEditing(null);
      load();
    } catch (err: unknown) {
      error(t("documents.governance.saveFailed"), apiErrorMessage(err, t("documents.governance.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="documents.governance.title"
        subtitle="documents.governance.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.admin", href: "/admin" },
              { label: "documents.register.title", href: "/admin/documents" },
              { label: "documents.governance.title" },
            ]}
          />
        }
        actions={
          <Link href="/admin/documents" className="btn-secondary text-sm">
            {t("documents.register.title")}
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="rule"
            title="documents.governance.empty"
            description="documents.governance.emptyHint"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">{row.title}</h2>
                  {row.description ? (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{row.description}</p>
                  ) : null}
                  <div className="mt-2">
                    <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                  </div>
                </div>
                <button type="button" className="btn-secondary text-sm" onClick={() => startEdit(row)}>
                  {t("documents.governance.update")}
                </button>
              </div>
              {editing === row.id ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="doc-gov-status" className="mb-1 block text-xs font-semibold text-neutral-700">
                      {t("documents.governance.status")}
                    </label>
                    <select
                      id="doc-gov-status"
                      className="form-input"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="pending">{t("documents.governance.pending")}</option>
                      <option value="decided">{t("documents.governance.decided")}</option>
                      <option value="not_applicable">{t("documents.governance.na")}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="doc-gov-notes" className="mb-1 block text-xs font-semibold text-neutral-700">
                      {t("documents.governance.notes")}
                    </label>
                    <textarea
                      id="doc-gov-notes"
                      className="form-input"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("documents.governance.notesPlaceholder")}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary text-sm disabled:opacity-60"
                      disabled={saving}
                      onClick={() => void save(row.id)}
                    >
                      {t("documents.governance.save")}
                    </button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => setEditing(null)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
