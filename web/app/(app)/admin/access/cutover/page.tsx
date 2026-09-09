"use client";

import { useCallback, useEffect, useState } from "react";
import { accessApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type ChecklistItem = { id: string; title: string; status: string; detail: string };

export default function AccessCutoverPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    accessApi
      .cutoverStatus()
      .then((r) => r.data)
      .then((payload) => {
        setItems(payload.data.checklist ?? []);
        setFrozen(Boolean(payload.data.legacy_role_edits_frozen));
      })
      .catch(() => setError(t("Unable to load cutover status.")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFreeze = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await accessApi.cutoverFreeze(!frozen);
      setFrozen(Boolean(res.data.data.frozen));
      load();
    } catch {
      setError(t("Unable to update freeze. Confirm you can manage roles."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("Access cutover")}
        subtitle={t("Freeze legacy Spatie role edits. Assign published role versions. Operator evidence stays unsigned here.")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("Admin"), href: "/admin" },
              { label: t("Access Governance"), href: "/admin/access" },
              { label: t("Access cutover") },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <section className="card space-y-3 p-5" aria-labelledby="freeze-heading">
        <h2 id="freeze-heading" className="text-sm font-semibold text-neutral-900">
          {t("Freeze legacy Spatie role edits")}
        </h2>
        <p className="text-sm text-neutral-600">
          {frozen
            ? t("Legacy Spatie role edits are frozen. Assign published access_role_versions instead.")
            : t("Legacy Spatie role edits are still allowed. Dual-control still applies to every Admin role sync.")}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={toggleFreeze}
          disabled={saving || loading}
          aria-pressed={frozen}
        >
          {saving
            ? t("Saving...")
            : frozen
              ? t("Unfreeze legacy role edits")
              : t("Freeze legacy Spatie role edits")}
        </button>
      </section>

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="fact_check"
          title={t("Access cutover")}
          description={t("Cutover checklist will appear when the status API is available.")}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                <span className="badge badge-muted text-xs">{item.status}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
