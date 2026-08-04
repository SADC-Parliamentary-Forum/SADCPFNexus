"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function ContributionSchedulesPage() {
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
    onError: () => toastError("Could not add schedule", "Please check the values and try again."),
  });

  const list = Array.isArray(data?.data) ? data.data : (data?.data?.data ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Donor / contribution calendar"
        subtitle="Structured inflow schedules for cashflow planning."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Donor / contribution calendar" }]} />}
      />
      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <label className="block space-y-1" htmlFor="contrib-donor-name">
          <span className="text-xs font-medium text-neutral-700">Donor name</span>
          <input id="contrib-donor-name" className="form-input w-full" placeholder="Donor name" value={form.donor_name} onChange={(e) => setForm({ ...form, donor_name: e.target.value })} />
        </label>
        <label className="block space-y-1" htmlFor="contrib-amount">
          <span className="text-xs font-medium text-neutral-700">Amount</span>
          <input id="contrib-amount" className="form-input w-full" type="number" min="0" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </label>
        <label className="block space-y-1" htmlFor="contrib-frequency">
          <span className="text-xs font-medium text-neutral-700">Frequency</span>
          <select id="contrib-frequency" className="form-input w-full" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="one_off">One-off</option>
          </select>
        </label>
        <label className="block space-y-1" htmlFor="contrib-start-date">
          <span className="text-xs font-medium text-neutral-700">Start date</span>
          <input id="contrib-start-date" className="form-input w-full" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </label>
        <label className="block space-y-1" htmlFor="contrib-currency">
          <span className="text-xs font-medium text-neutral-700">Currency</span>
          <input id="contrib-currency" className="form-input w-full" placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        </label>
        <div className="flex items-end">
          <button type="button" className="btn-primary" disabled={!form.donor_name || !form.amount || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Adding…" : "Add schedule"}
          </button>
        </div>
      </div>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-2">Donor</th><th className="p-2">Amount</th><th className="p-2">Frequency</th><th className="p-2">Next due</th></tr></thead>
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
                <tr>
                  <td colSpan={4} className="p-4 text-center text-sm text-neutral-500">No schedules yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
