"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type MeSettings } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MandeSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [form, setForm] = useState<MeSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "settings"],
    queryFn: () => mandeApi.getSettings().then((r) => r.data.data as MeSettings),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: MeSettings) => mandeApi.updateSettings(payload),
    onSuccess: (res) => {
      qc.setQueryData(["mande", "settings"], res.data.data);
      setForm(res.data.data);
      setSavedMsg(t("mande.settings.savedMsg"));
      toast.success(t("mande.settings.saved"));
      setTimeout(() => setSavedMsg(null), 2500);
    },
    onError: (err) => toast.error(t("mande.settings.notSaved"), apiErrorMessage(err, t("mande.settings.saveFailedDetail"))),
  });

  if (!canAdmin) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">
        {t("mande.settings.needBefore")} <code className="font-mono">mande.admin</code> {t("mande.settings.needAfter")} {/* i18n-ignore */}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("mande.settings.title")}
        subtitle={t("mande.settings.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.settings.title") }]} />}
      />

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.settings.loadFailed")}
        </div>
      )}

      {isLoading || !form ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <div className="card p-5 space-y-5">
          {savedMsg && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{savedMsg}</div>
          )}

          <label htmlFor="mande-settings-setform-auto-intake-on-pif-approve-when-enabled-" className="flex items-start gap-3">
            <input id="mande-settings-setform-auto-intake-on-pif-approve-when-enabled-"
              type="checkbox"
              className="mt-1"
              checked={form.auto_intake}
              onChange={(e) => setForm({ ...form, auto_intake: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-semibold text-neutral-800">{t("mande.settings.autoIntake")}</span>
              <span className="block text-xs text-neutral-500">
                {t("mande.settings.autoIntakeHint")}
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="mande-settings-report-due-days" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.settings.dueDays")}</label>
            <input id="mande-settings-report-due-days"
              type="number"
              min={1}
              max={365}
              className="form-input max-w-[140px]"
              value={form.report_due_days}
              onChange={(e) => setForm({ ...form, report_due_days: Number(e.target.value) || 14 })}
            />
            <p className="text-xs text-neutral-500 mt-1">{t("mande.settings.dueDaysHint")}</p>
          </div>

          <label htmlFor="mande-settings-setform-programme-manager-review-when-enabled-re" className="flex items-start gap-3">
            <input id="mande-settings-setform-programme-manager-review-when-enabled-re"
              type="checkbox"
              className="mt-1"
              checked={form.programme_manager_review}
              onChange={(e) => setForm({ ...form, programme_manager_review: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-semibold text-neutral-800">{t("mande.settings.pmReview")}</span>
              <span className="block text-xs text-neutral-500">
                {t("mande.settings.pmReviewHint")}
              </span>
            </span>
          </label>

          {saveMut.isError && (
            <p className="text-sm text-red-600">{t("mande.settings.saveFailed")}</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary disabled:opacity-40"
              disabled={saveMut.isPending || form.report_due_days < 1}
              onClick={() => saveMut.mutate(form)}
            >
              {saveMut.isPending ? t("correspondence.saving") : t("correspondence.mailbox.saveSettings")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
