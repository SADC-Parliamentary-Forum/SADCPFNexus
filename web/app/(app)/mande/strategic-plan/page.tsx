"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type StrategicPlan } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const EMPTY: Partial<StrategicPlan> = {
  name: "",
  period: "",
  start_date: "",
  end_date: "",
  description: "",
  status: "draft",
};

export default function StrategicPlanPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [modal, setModal] = useState<Partial<StrategicPlan> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "strategic-plans"],
    queryFn: () =>
      mandeApi.listPlans({ per_page: 100 }).then((r) => r.data.data as StrategicPlan[]),
    staleTime: 20_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Partial<StrategicPlan>) =>
      payload.id
        ? mandeApi.updatePlan(payload.id, payload)
        : mandeApi.createPlan(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] });
      setModal(null);
    },
  });

  const archiveMut = useMutation({
    mutationFn: (id: number) => mandeApi.archivePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] }),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => mandeApi.activatePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => mandeApi.deletePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] }),
  });

  const plans = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Strategic Plans"
        subtitle="Configure institutional strategic plans and periods for results alignment."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Strategic Plans" }]} />}
      />
        {canAdmin && (
          <button type="button" onClick={() => setModal({ ...EMPTY })} className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Plan
          </button>
        )}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load strategic plans.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">flag</span>
            <p className="text-sm text-neutral-500">No strategic plans yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Period</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Goals</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-neutral-900">{p.name}</td>
                  <td className="text-xs text-neutral-500">{p.period ?? "—"}</td>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {p.start_date ? formatDateShort(p.start_date) : "—"}
                    {" → "}
                    {p.end_date ? formatDateShort(p.end_date) : "—"}
                  </td>
                  <td>
                    <span className={`badge ${p.status === "active" ? "badge-success" : p.status === "archived" ? "badge-muted" : "badge-warning"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-500">{p.goals_count ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    <Link
                      href={`/mande/strategic-plan/${p.id}`}
                      className="text-primary text-xs hover:underline mr-3"
                    >
                      {canAdmin ? "Manage hierarchy" : "Open"}
                    </Link>
                    {canAdmin && (
                      <>
                        <button type="button" className="text-primary text-xs hover:underline mr-3" onClick={() => setModal({ ...p })}>
                          Edit
                        </button>
                        {p.status !== "active" && (
                          <button type="button" className="text-green-700 text-xs hover:underline mr-3" onClick={() => activateMut.mutate(p.id)}>
                            Activate
                          </button>
                        )}
                        {p.status !== "archived" && (
                          <button type="button" className="text-neutral-500 text-xs hover:underline mr-3" onClick={() => archiveMut.mutate(p.id)}>
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-red-500 text-xs hover:underline"
                          onClick={async () => {
                            if (await confirm({ title: "Delete plan", message: "Delete this plan? This cannot be undone.", variant: "danger" })) {
                              delMut.mutate(p.id);
                            }
                          }}
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
              <h2 className="font-semibold text-neutral-800">{modal.id ? "Edit Plan" : "New Plan"}</h2>
              <button type="button" onClick={() => setModal(null)} className="text-neutral-400 hover:text-neutral-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Name *</label>
                <input className="form-input" value={modal.name ?? ""} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Period</label>
                <input className="form-input" value={modal.period ?? ""} onChange={(e) => setModal({ ...modal, period: e.target.value })} placeholder="e.g. 2024–2028" />
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
