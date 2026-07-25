"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type Indicator, type ResultLevel } from "@/lib/api";
import { exportToXls } from "@/lib/csvExport";

const RESULT_LEVELS: { value: ResultLevel; label: string; cls: string }[] = [
  { value: "impact",   label: "Impact",   cls: "badge-danger"  },
  { value: "outcome",  label: "Outcome",  cls: "badge-primary" },
  { value: "output",   label: "Output",   cls: "badge-success" },
  { value: "activity", label: "Activity", cls: "badge-muted"   },
];

const FREQUENCIES = ["monthly", "quarterly", "bi_annual", "annual"];
const DISAGG_OPTIONS = ["sex", "age", "country", "disability", "constituency"];

const EMPTY: Partial<Indicator> = {
  name: "", result_level: "output", unit: "", frequency: "quarterly",
  evidence_required: true, is_active: true, disaggregation: [],
};

export default function IndicatorsPage() {
  const qc = useQueryClient();
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Partial<Indicator> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mande", "indicators", levelFilter, search],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 200 };
      if (levelFilter !== "All") params.result_level = levelFilter;
      if (search) params.search = search;
      return mandeApi.listIndicators(params).then((r) => (r.data as { data: Indicator[] }).data);
    },
    staleTime: 20_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Partial<Indicator>) =>
      payload.id ? mandeApi.updateIndicator(payload.id, payload) : mandeApi.createIndicator(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mande", "indicators"] });
      setModal(null);
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => mandeApi.deleteIndicator(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mande", "indicators"] }),
  });

  const indicators = data ?? [];

  function toggleDisagg(v: string) {
    if (!modal) return;
    const cur = modal.disaggregation ?? [];
    setModal({ ...modal, disaggregation: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Indicators</h1>
          <p className="page-subtitle">Define and manage results-framework indicators, baselines and targets.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToXls("indicators", indicators.map((i) => ({
              code: i.code, name: i.name, level: i.result_level, unit: i.unit,
              baseline: i.baseline_value, annual_target: i.annual_target, frequency: i.frequency,
              active: i.is_active ? "Yes" : "No",
            })))}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">table_view</span>Excel
          </button>
          <button onClick={() => setModal({ ...EMPTY })} className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>New Indicator
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["All", ...RESULT_LEVELS.map((l) => l.value)].map((f) => (
          <button key={f} onClick={() => setLevelFilter(f)} className={`filter-tab ${levelFilter === f ? "active" : ""}`}>
            {f === "All" ? "All" : RESULT_LEVELS.find((l) => l.value === f)!.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search indicators…"
          className="ml-auto form-input text-sm max-w-xs"
        />
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : indicators.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">speed</span>
            <p className="text-sm text-neutral-500">No indicators defined yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Level</th><th>Unit</th><th>Baseline</th><th>Annual Target</th><th>Frequency</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {indicators.map((ind) => {
                const lvl = RESULT_LEVELS.find((l) => l.value === ind.result_level);
                return (
                  <tr key={ind.id}>
                    <td className="font-mono text-xs">{ind.code}</td>
                    <td className="font-medium text-neutral-900 max-w-xs"><span className="line-clamp-2">{ind.name}</span></td>
                    <td><span className={`badge ${lvl?.cls}`}>{lvl?.label}</span></td>
                    <td className="text-xs text-neutral-500">{ind.unit ?? "—"}</td>
                    <td className="text-xs text-neutral-500">{ind.baseline_value ?? "—"}</td>
                    <td className="text-xs text-neutral-700 font-medium">{ind.annual_target ?? "—"}</td>
                    <td className="text-xs text-neutral-500 capitalize">{ind.frequency?.replace("_", "-") ?? "—"}</td>
                    <td>{ind.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                    <td className="whitespace-nowrap">
                      <button onClick={() => setModal({ ...ind })} className="text-primary text-xs hover:underline mr-3">Edit</button>
                      <button
                        onClick={() => {
                          if (confirm("Create a version snapshot of this indicator?")) {
                            mandeApi.createIndicatorVersion(ind.id, { label: `Snapshot ${new Date().toISOString().slice(0, 10)}` })
                              .then(() => alert("Version snapshot created."));
                          }
                        }}
                        className="text-neutral-600 text-xs hover:underline mr-3"
                      >
                        Snapshot
                      </button>
                      <button onClick={() => { if (confirm("Delete this indicator?")) delMut.mutate(ind.id); }} className="text-red-500 text-xs hover:underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-800">{modal.id ? "Edit Indicator" : "New Indicator"}</h2>
              <button onClick={() => setModal(null)} className="text-neutral-400 hover:text-neutral-700"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Indicator name *</label>
                <input className="form-input" value={modal.name ?? ""} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Result level *</label>
                  <select className="form-input" value={modal.result_level} onChange={(e) => setModal({ ...modal, result_level: e.target.value as ResultLevel })}>
                    {RESULT_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Unit of measure</label>
                  <input className="form-input" value={modal.unit ?? ""} onChange={(e) => setModal({ ...modal, unit: e.target.value })} placeholder="e.g. count, %" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Baseline</label>
                  <input type="number" className="form-input" value={modal.baseline_value as number ?? ""} onChange={(e) => setModal({ ...modal, baseline_value: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Annual target</label>
                  <input type="number" className="form-input" value={modal.annual_target as number ?? ""} onChange={(e) => setModal({ ...modal, annual_target: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Cumulative target</label>
                  <input type="number" className="form-input" value={modal.cumulative_target as number ?? ""} onChange={(e) => setModal({ ...modal, cumulative_target: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Frequency</label>
                  <select className="form-input" value={modal.frequency ?? ""} onChange={(e) => setModal({ ...modal, frequency: (e.target.value || null) as Indicator["frequency"] })}>
                    <option value="">—</option>
                    {FREQUENCIES.map((f) => <option key={f} value={f} className="capitalize">{f.replace("_", "-")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Data source</label>
                  <input className="form-input" value={modal.data_source ?? ""} onChange={(e) => setModal({ ...modal, data_source: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Disaggregation</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DISAGG_OPTIONS.map((d) => (
                    <button key={d} type="button" onClick={() => toggleDisagg(d)}
                      className={`px-2.5 py-1 rounded-full text-xs border capitalize ${(modal.disaggregation ?? []).includes(d) ? "bg-primary text-white border-primary" : "bg-white text-neutral-600 border-neutral-300"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={!!modal.evidence_required} onChange={(e) => setModal({ ...modal, evidence_required: e.target.checked })} />
                  Evidence required
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={!!modal.is_active} onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} />
                  Active
                </label>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button
                disabled={!modal.name || saveMut.isPending}
                onClick={() => saveMut.mutate(modal)}
                className="btn-primary disabled:opacity-40"
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
