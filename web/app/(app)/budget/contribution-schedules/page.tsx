"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ContributionSchedulesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { error: toastError } = useToast();
  const [form, setForm] = useState({
    donor_name: "",
    source_type: "donor",
    currency: "NAD",
    amount: "",
    frequency: "quarterly",
    start_date: new Date().toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["contribution-schedules"],
    queryFn: async () => (await api.get("/budget/contribution-schedules")).data,
  });

  const save = useMutation({
    mutationFn: () => api.post("/budget/contribution-schedules", { ...form, amount: Number(form.amount) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contribution-schedules"] }),
    onError: () => toastError(t("budget.schedules.addFailed"), t("budget.checkValues")),
  });

  const list = Array.isArray(data?.data) ? data.data : (data?.data?.data ?? []);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="budget.schedules.title"
        subtitle="budget.schedules.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "budget.schedules.title" }]} />}
      />
      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <label htmlFor="contrib-donor-name" className="block space-y-1">
          <span className="text-xs font-medium text-neutral-700">{t("budget.schedules.donorName")}</span>
          <input id="contrib-donor-name" className="form-input w-full" placeholder={t("budget.schedules.donorName")} value={form.donor_name} onChange={(e) => setForm({ ...form, donor_name: e.target.value })} />
        </label>
        <label htmlFor="contrib-amount" className="block space-y-1">
          <span className="text-xs font-medium text-neutral-700">{t("budget.amount")}</span>
          <input id="contrib-amount" className="form-input w-full" type="number" min="0" placeholder={t("budget.amount")} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </label>
        <label htmlFor="contrib-frequency" className="block space-y-1">
          <span className="text-xs font-medium text-neutral-700">{t("budget.schedules.frequency")}</span>
          <select id="contrib-frequency" className="form-input w-full" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
            <option value="monthly">{t("srhr.reportType.monthly")}</option>
            <option value="quarterly">{t("srhr.reportType.quarterly")}</option>
            <option value="annual">{t("srhr.reportType.annual")}</option>
            <option value="one_off">{t("budget.schedules.oneOff")}</option>
          </select>
        </label>
        <label htmlFor="contrib-start-date" className="block space-y-1">
          <span className="text-xs font-medium text-neutral-700">{t("common.startDate")}</span>
          <input id="contrib-start-date" className="form-input w-full" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </label>
        <label htmlFor="contrib-currency" className="block space-y-1">
          <span className="text-xs font-medium text-neutral-700">{t("externalRfq.currency")}</span>
          <input id="contrib-currency" className="form-input w-full" placeholder={t("externalRfq.currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        </label>
        <div className="flex items-end">
          <button type="button" className="btn-primary" disabled={!form.donor_name || !form.amount || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("budget.adding") : t("budget.schedules.add")}
          </button>
        </div>
      </div>
      {isLoading ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-2">{t("hr.timesheets.templates.donor")}</th><th className="p-2">{t("budget.amount")}</th><th className="p-2">{t("budget.schedules.frequency")}</th><th className="p-2">{t("budget.schedules.nextDue")}</th></tr></thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="p-2">{r.donor_name}</td>
                  <td className="p-2">{r.currency} {r.amount}</td>
                  <td className="p-2">{r.frequency}</td>
                  <td className="p-2">{String(r.next_due_date ?? "").slice(0, 10)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <TableEmpty colSpan={4} title={t("hr.timesheets.schedules.empty")} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
