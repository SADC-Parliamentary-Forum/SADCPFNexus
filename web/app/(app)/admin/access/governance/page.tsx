"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Decision = { id: number; topic: string; status: string; decision_notes?: string };

export default function GovernanceChecklistPage() {
  const { t } = useI18n();
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
      .catch(() => setError(t("admin.access.governance.loadFailed")))
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
      setError(t("admin.access.governance.saveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("admin.access.links.governance")}
        subtitle={t("admin.access.governance.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.crumb.access"), href: "/admin/access" },
              { label: t("admin.access.governance.crumb") },
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
          <EmptyState icon="policy" title={t("admin.access.governance.empty")} description={t("admin.access.governance.emptyDesc")} />
        </div>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {rows.map((r) => {
            const draft = drafts[r.id] ?? { status: r.status, decision_notes: r.decision_notes ?? "" };
            return (
              <div key={r.id} className="space-y-3 px-4 py-4">
                <p className="text-sm font-medium text-neutral-900">{r.topic}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label htmlFor={`admin-access-governance-status-${r.id}`} className="text-xs text-neutral-600">
                    {t("admin.common.status")}
                    <select id={`admin-access-governance-status-${r.id}`}
                      className="form-input mt-1 block min-w-[10rem]"
                      value={draft.status}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...draft, status: e.target.value },
                        }))
                      }
                    >
                      <option value="pending">{t("admin.common.statusPending")}</option>
                      <option value="decided">{t("admin.common.statusDecided")}</option>
                      <option value="not_applicable">{t("admin.common.statusNotApplicable")}</option>
                    </select>
                  </label>
                  <label htmlFor={`admin-access-governance-notes-${r.id}`} className="min-w-[16rem] flex-1 text-xs text-neutral-600">
                    {t("admin.access.governance.decisionNotes")}
                    <textarea id={`admin-access-governance-notes-${r.id}`}
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
                    {savingId === r.id ? t("admin.common.saving") : t("common.save")}
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
