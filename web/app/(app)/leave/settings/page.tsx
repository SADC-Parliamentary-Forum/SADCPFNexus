"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { leaveApi, type LeavePolicyVersion } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const MODES = ["standard", "finance_first", "director_principal"] as const;

export default function LeaveSettingsPage() {
  const { t } = useI18n();
  const [policies, setPolicies] = useState<LeavePolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    version: "",
    effective_from: "",
    workflow_mode: "standard",
    admin_review_required: false,
    change_reason: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await leaveApi.listPolicies();
      setPolicies(res.data.data ?? []);
    } catch {
      setError(t("leave.settings.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await leaveApi.createPolicy({
        ...form,
        admin_review_required:
          form.workflow_mode === "director_principal" ? true : form.admin_review_required,
        principal_role: "Director",
        final_approver_role: "Secretary General",
      });
      setForm({
        version: "",
        effective_from: "",
        workflow_mode: "standard",
        admin_review_required: false,
        change_reason: "",
      });
      await load();
    } catch {
      setError(t("leave.settings.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const active = policies.find((p) => p.is_active);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("leave.settings.title")}
        subtitle={t("leave.settings.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("nav.leave"), href: "/leave" }, { label: t("leave.settings.breadcrumb") }]} />
        }
        actions={
          <Link href="/leave" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {t("common.back")}
          </Link>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      ) : (
        <>
          <FormSection title={t("leave.settings.activePolicy")} icon="verified">
            {active ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-neutral-500">{t("leave.settings.version")}</dt>
                  <dd className="font-medium">{active.version}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{t("leave.settings.mode")}</dt>
                  <dd className="font-medium">{active.workflow_mode ?? "standard"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{t("leave.settings.principalReview")}</dt>
                  <dd className="font-medium">{active.admin_review_required ? t("leave.settings.principalDirector") : t("leave.settings.off")}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{t("leave.settings.effectiveFrom")}</dt>
                  <dd className="font-medium">
                    {active.effective_from ? formatDate(active.effective_from) : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyState icon="policy" title={t("leave.settings.noActive")} className="min-h-0 py-6" />
            )}
          </FormSection>

          <FormSection title={t("leave.settings.createTitle")} icon="add_circle" description={t("leave.settings.createHint")}>
            <form onSubmit={createVersion} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="leave-settings-version" className="mb-1 block text-xs font-semibold text-neutral-700">{t("leave.settings.version")}</label>
                <input id="leave-settings-version"
                  className="form-input"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="v2"
                  required
                />
              </div>
              <div>
                <label htmlFor="leave-settings-effective-from" className="mb-1 block text-xs font-semibold text-neutral-700">{t("leave.settings.effectiveFrom")}</label>
                <input id="leave-settings-effective-from"
                  type="date"
                  className="form-input"
                  value={form.effective_from}
                  onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="leave-settings-workflow-mode" className="mb-1 block text-xs font-semibold text-neutral-700">{t("leave.settings.workflowMode")}</label>
                <select id="leave-settings-workflow-mode"
                  className="form-input"
                  value={form.workflow_mode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      workflow_mode: e.target.value,
                      admin_review_required: e.target.value === "director_principal",
                    })
                  }
                >
                  {MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(`leave.settings.mode.${mode}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="leave-settings-setform-disabled-classname-h-4-w-4-rounded-borde" className="flex items-center gap-2 text-sm text-neutral-700">
                  <input id="leave-settings-setform-disabled-classname-h-4-w-4-rounded-borde"
                    type="checkbox"
                    checked={form.admin_review_required || form.workflow_mode === "director_principal"}
                    onChange={(e) => setForm({ ...form, admin_review_required: e.target.checked })}
                    disabled={form.workflow_mode === "director_principal"}
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  />
                  {t("leave.settings.principalRequired")}
                </label>
              </div>
              <div className="col-span-2">
                <label htmlFor="leave-settings-change-reason" className="mb-1 block text-xs font-semibold text-neutral-700">{t("leave.settings.changeReason")}</label>
                <textarea id="leave-settings-change-reason"
                  className="form-input resize-none"
                  rows={2}
                  value={form.change_reason}
                  onChange={(e) => setForm({ ...form, change_reason: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t("leave.settings.saving") : t("leave.settings.activate")}
            </button>
            </form>
          </FormSection>

          <FormSection title={t("leave.settings.history")} icon="history">
            {policies.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("leave.settings.noVersions")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {policies.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span>
                      {p.version} · {p.workflow_mode ?? "standard"}
                      {p.is_active ? (
                        <span className="badge-success ml-2">{t("leave.settings.active")}</span>
                      ) : null}
                    </span>
                    <span className="text-neutral-500">
                      {p.effective_from ? formatDate(p.effective_from) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        </>
      )}
    </div>
  );
}
