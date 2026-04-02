"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { policyApi, type Policy } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STATUS_OPTS = ["all", "active", "archived"] as const;

function RenewalBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-neutral-400">—</span>;
  const d    = new Date(date);
  const now  = new Date();
  const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  const cls  = days < 0 ? "text-red-600 bg-red-50 border-red-200"
             : days < 90 ? "text-amber-700 bg-amber-50 border-amber-200"
             : "text-neutral-600 bg-neutral-50 border-neutral-200";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {days < 0 && <span className="material-symbols-outlined text-[12px]">warning</span>}
      {formatDateShort(date)}
    </span>
  );
}

type PolicyForm = { title: string; description: string; owner_name: string; renewal_date: string; status: "active" | "archived" };
function EmptyForm(): PolicyForm {
  return { title: "", description: "", owner_name: "", renewal_date: "", status: "active" };
}

export default function PolicyLibraryPage() {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [search, setSearch]             = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<Policy | null>(null);
  const [form, setForm]                 = useState<PolicyForm>(EmptyForm());
  const [saving, setSaving]             = useState(false);

  const params = {
    per_page: 50,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["risk-policies", statusFilter, search],
    queryFn: () => policyApi.list(params).then((r) => r.data.data ?? []),
    staleTime: 30_000,
  });

  const policies: Policy[] = data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => policyApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risk-policies"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EmptyForm());
    setShowModal(true);
  }

  function openEdit(p: Policy) {
    setEditing(p);
    setForm({ title: p.title, description: p.description ?? "", owner_name: p.owner_name ?? "", renewal_date: p.renewal_date ?? "", status: p.status });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, renewal_date: form.renewal_date || null, description: form.description || null, owner_name: form.owner_name || null };
      if (editing) {
        await policyApi.update(editing.id, payload);
      } else {
        await policyApi.create(payload);
      }
      qc.invalidateQueries({ queryKey: ["risk-policies"] });
      setShowModal(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Policy Library</h1>
          <p className="page-subtitle">Manage organisational policies and link them to risks in the register.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">add</span> New Policy
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {STATUS_OPTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`filter-tab capitalize ${statusFilter === s ? "active" : ""}`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policies…"
          className="form-input w-60"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-primary text-2xl mr-2">progress_activity</span>
            <span className="text-sm text-neutral-400">Loading policies…</span>
          </div>
        ) : policies.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-neutral-200 text-5xl block mb-3">policy</span>
            <p className="text-sm text-neutral-400">No policies found.</p>
            <button onClick={openCreate} className="btn-primary mt-4 mx-auto">Add First Policy</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Policy Title</th>
                <th>Owner</th>
                <th>Renewal Date</th>
                <th>Linked Risks</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/risk/policies/${p.id}`} className="font-semibold text-neutral-900 hover:text-primary">
                      {p.title}
                    </Link>
                  </td>
                  <td className="text-neutral-600">{p.owner_name ?? "—"}</td>
                  <td><RenewalBadge date={p.renewal_date} /></td>
                  <td className="text-neutral-500">{p.risks_count ?? 0}</td>
                  <td>
                    <span className={`badge-${p.status === "active" ? "success" : "muted"}`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/risk/policies/${p.id}`} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary" title="View">
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      </Link>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary" title="Edit">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this policy?")) deleteMutation.mutate(p.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-neutral-900">{editing ? "Edit Policy" : "New Policy"}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Title <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required className="form-input w-full" placeholder="e.g. ICT Policy" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="form-input w-full h-20 resize-none" placeholder="Brief description of the policy…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Owner</label>
                  <input value={form.owner_name} onChange={(e) => setForm(f => ({ ...f, owner_name: e.target.value }))} className="form-input w-full" placeholder="e.g. Ronald Windwaai" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Renewal Date</label>
                  <input type="date" value={form.renewal_date} onChange={(e) => setForm(f => ({ ...f, renewal_date: e.target.value }))} className="form-input w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">Status</label>
                <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as "active" | "archived" }))} className="form-input w-full">
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                  {saving ? "Saving…" : editing ? "Save Changes" : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
