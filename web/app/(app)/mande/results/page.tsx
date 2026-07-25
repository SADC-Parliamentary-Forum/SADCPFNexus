"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RESULTS_FRAMEWORK_TYPES,
  mandeApi,
  type ResultsFramework,
  type ResultsFrameworkType,
} from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

const EMPTY: Partial<ResultsFramework> = {
  name: "",
  type: "sadc_pf",
  donor_name: "",
  description: "",
  status: "active",
};

export default function ResultsFrameworksPage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modal, setModal] = useState<Partial<ResultsFramework> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "results-frameworks", typeFilter],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 100 };
      if (typeFilter !== "All") params.type = typeFilter;
      return mandeApi.listFrameworks(params).then((r) => r.data.data as ResultsFramework[]);
    },
    staleTime: 20_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Partial<ResultsFramework>) =>
      payload.id
        ? mandeApi.updateFramework(payload.id, payload)
        : mandeApi.createFramework(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mande", "results-frameworks"] });
      setModal(null);
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => mandeApi.deleteFramework(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mande", "results-frameworks"] }),
  });

  const frameworks = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Results Frameworks</h1>
          <p className="page-subtitle">Manage results frameworks linked to strategic plans and donor programmes.</p>
        </div>
        {canAdmin && (
          <button type="button" onClick={() => setModal({ ...EMPTY })} className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Framework
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {["All", ...RESULTS_FRAMEWORK_TYPES.map((t) => t.value)].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTypeFilter(f)}
            className={`filter-tab ${typeFilter === f ? "active" : ""}`}
          >
            {f === "All" ? "All" : RESULTS_FRAMEWORK_TYPES.find((t) => t.value === f)?.label ?? f}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load results frameworks.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : frameworks.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">account_tree</span>
            <p className="text-sm text-neutral-500">No results frameworks defined yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Donor</th>
                <th>Plan</th>
                <th>Indicators</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map((fw) => (
                <tr key={fw.id}>
                  <td className="font-medium text-neutral-900">{fw.name}</td>
                  <td className="text-xs text-neutral-500">
                    {RESULTS_FRAMEWORK_TYPES.find((t) => t.value === fw.type)?.label ?? fw.type}
                  </td>
                  <td className="text-xs text-neutral-500">{fw.donor_name ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{fw.plan?.name ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{fw.indicators_count ?? "—"}</td>
                  <td>
                    <span className={`badge ${fw.status === "active" ? "badge-success" : "badge-muted"}`}>
                      {fw.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {canAdmin && (
                      <>
                        <button type="button" className="text-primary text-xs hover:underline mr-3" onClick={() => setModal({ ...fw })}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-red-500 text-xs hover:underline"
                          onClick={() => { if (confirm("Delete this framework?")) delMut.mutate(fw.id); }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-800">{modal.id ? "Edit Framework" : "New Framework"}</h2>
              <button type="button" onClick={() => setModal(null)} className="text-neutral-400 hover:text-neutral-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Name *</label>
                <input className="form-input" value={modal.name ?? ""} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Type *</label>
                  <select
                    className="form-input"
                    value={modal.type ?? "sadc_pf"}
                    onChange={(e) => setModal({ ...modal, type: e.target.value as ResultsFrameworkType })}
                  >
                    {RESULTS_FRAMEWORK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Donor name</label>
                  <input className="form-input" value={modal.donor_name ?? ""} onChange={(e) => setModal({ ...modal, donor_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Start</label>
                  <input type="date" className="form-input" value={modal.start_date?.slice(0, 10) ?? ""} onChange={(e) => setModal({ ...modal, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">End</label>
                  <input type="date" className="form-input" value={modal.end_date?.slice(0, 10) ?? ""} onChange={(e) => setModal({ ...modal, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
                <textarea className="form-input min-h-[80px]" value={modal.description ?? ""} onChange={(e) => setModal({ ...modal, description: e.target.value })} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary disabled:opacity-40"
                disabled={!modal.name?.trim() || saveMut.isPending}
                onClick={() => saveMut.mutate(modal)}
              >
                {saveMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
