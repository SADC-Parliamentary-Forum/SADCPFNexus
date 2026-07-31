"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export default function ContributionSchedulesPage() {
  const qc = useQueryClient();
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
        <input className="form-input" placeholder="Donor name" value={form.donor_name} onChange={(e) => setForm({ ...form, donor_name: e.target.value })} />
        <input className="form-input" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <select className="form-input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
          <option value="one_off">One-off</option>
        </select>
        <input className="form-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        <input className="form-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        <button type="button" className="btn-primary" disabled={!form.donor_name || !form.amount || save.isPending} onClick={() => save.mutate()}>Add schedule</button>
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
