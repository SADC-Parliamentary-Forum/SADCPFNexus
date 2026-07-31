"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export default function PayrollImportsPage() {
  const qc = useQueryClient();
  const [json, setJson] = useState('[{"employee_number":"E1","gross":1000,"deductions":100,"net":900,"period":"2026-07"}]');
  const { data, isLoading } = useQuery({
    queryKey: ["payroll-imports"],
    queryFn: async () => (await api.get("/finance/payroll/imports")).data,
  });
  const importMut = useMutation({
    mutationFn: async () => {
      const lines = JSON.parse(json);
      return (await api.post("/finance/payroll/imports", { period: "2026-07", lines })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-imports"] }),
  });
  const list = Array.isArray(data?.data) ? data.data : (data?.data?.data ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Payroll vendor import"
        subtitle="Stage payslip lines from JSON or configured HTTP vendor. No OT rates invented."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Payroll vendor import" }]} />}
      />
      <textarea className="form-input min-h-40 w-full font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
      <button type="button" className="btn-primary" onClick={() => importMut.mutate()} disabled={importMut.isPending}>Import draft batch</button>
      {importMut.isError && <p className="text-sm text-red-700">Import failed — check JSON.</p>}
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-2">Ref</th><th className="p-2">Driver</th><th className="p-2">Status</th><th className="p-2">Lines</th></tr></thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="p-2">{r.reference}</td>
                  <td className="p-2">{r.driver}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.line_count ?? r.lines_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
