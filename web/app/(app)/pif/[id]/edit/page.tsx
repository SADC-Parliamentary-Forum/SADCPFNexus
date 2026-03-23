"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { programmeApi, tenantUsersApi, type Programme } from "@/lib/api";

export default function PifEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [strategicPillar, setStrategicPillar] = useState("");
  const [implementingDepartment, setImplementingDepartment] = useState("");
  const [background, setBackground] = useState("");
  const [overallObjective, setOverallObjective] = useState("");
  const [primaryCurrency, setPrimaryCurrency] = useState("USD");
  const [totalBudget, setTotalBudget] = useState("");
  const [fundingSource, setFundingSource] = useState("");
  const [responsibleOfficerId, setResponsibleOfficerId] = useState<number | "">("");
  const [tenantUsers, setTenantUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelRequired, setTravelRequired] = useState(false);
  const [delegatesCount, setDelegatesCount] = useState("");
  const [procurementRequired, setProcurementRequired] = useState(false);

  useEffect(() => {
    tenantUsersApi.list().then((r) => setTenantUsers(r.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    programmeApi
      .get(Number(id))
      .then((r) => {
        const p = r.data;
        setProgramme(p);
        setTitle(p.title ?? "");
        setStrategicPillar(p.strategic_pillar ?? "");
        setImplementingDepartment(p.implementing_department ?? "");
        setBackground(p.background ?? "");
        setOverallObjective(p.overall_objective ?? "");
        setPrimaryCurrency(p.primary_currency ?? "USD");
        setTotalBudget(p.total_budget != null ? String(p.total_budget) : "");
        setFundingSource(p.funding_source ?? "");
        const roId = p.responsible_officer_id ?? (p as { responsibleOfficer?: { id: number } }).responsibleOfficer?.id ?? null;
        setResponsibleOfficerId(roId != null ? roId : "");
        setStartDate(p.start_date ?? "");
        setEndDate(p.end_date ?? "");
        setTravelRequired(p.travel_required ?? false);
        setDelegatesCount(p.delegates_count != null ? String(p.delegates_count) : "");
        setProcurementRequired(p.procurement_required ?? false);
        setError(null);
      })
      .catch(() => setError("Failed to load programme."))
      .finally(() => setLoading(false));
  }, [id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programme) return;
    setSubmitting(true);
    try {
      await programmeApi.update(programme.id, {
        title: title || undefined,
        strategic_pillar: strategicPillar || undefined,
        implementing_department: implementingDepartment || undefined,
        background: background || undefined,
        overall_objective: overallObjective || undefined,
        primary_currency: primaryCurrency || undefined,
        total_budget: totalBudget ? parseFloat(totalBudget) : undefined,
        funding_source: fundingSource || undefined,
        responsible_officer_id: responsibleOfficerId === "" ? null : responsibleOfficerId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        travel_required: travelRequired,
        delegates_count: delegatesCount ? parseInt(delegatesCount, 10) : undefined,
        procurement_required: procurementRequired,
      });
      showToast("Programme updated.");
      router.push(`/pif/${programme.id}`);
    } catch {
      showToast("Failed to update programme.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <span className="material-symbols-outlined animate-spin text-[24px] mr-2">progress_activity</span>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }
  if (error || !programme) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error ?? "Programme not found."}
        </div>
        <Link href="/pif" className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Programmes
        </Link>
      </div>
    );
  }

  if (programme.status !== "draft") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Only draft programmes can be edited.
        </div>
        <Link href={`/pif/${programme.id}`} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          Back to programme
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/pif" className="hover:text-primary transition-colors">Programmes</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href={`/pif/${programme.id}`} className="hover:text-primary transition-colors">{programme.reference_number}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Edit</span>
      </div>
      <h1 className="text-xl font-bold text-neutral-900">Edit programme</h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            required
            className="form-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Programme title"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Strategic pillar</label>
            <input className="form-input w-full" value={strategicPillar} onChange={(e) => setStrategicPillar(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Implementing department</label>
            <input className="form-input w-full" value={implementingDepartment} onChange={(e) => setImplementingDepartment(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Background</label>
          <textarea rows={4} className="form-input w-full resize-none" value={background} onChange={(e) => setBackground(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Overall objective</label>
          <textarea rows={3} className="form-input w-full resize-none" value={overallObjective} onChange={(e) => setOverallObjective(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Primary currency</label>
            <input className="form-input w-full" value={primaryCurrency} onChange={(e) => setPrimaryCurrency(e.target.value)} placeholder="e.g. USD" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Total budget</label>
            <input type="number" min="0" step="any" className="form-input w-full" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Funding source</label>
            <input className="form-input w-full" value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Responsible officer</label>
            <p className="text-xs text-neutral-400 mb-1">Must be a user registered in the system</p>
            <select
              className="form-input w-full"
              value={responsibleOfficerId === "" ? "" : String(responsibleOfficerId)}
              onChange={(e) => setResponsibleOfficerId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select responsible officer…</option>
              {tenantUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} {u.email ? `(${u.email})` : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Start date</label>
            <input type="date" className="form-input w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">End date</label>
            <input type="date" className="form-input w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={travelRequired} onChange={(e) => setTravelRequired(e.target.checked)} className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">Travel required</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={procurementRequired} onChange={(e) => setProcurementRequired(e.target.checked)} className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">Procurement required</span>
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Delegates count</label>
          <input type="number" min="0" className="form-input w-full max-w-[120px]" value={delegatesCount} onChange={(e) => setDelegatesCount(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
          <button type="submit" disabled={submitting} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {submitting ? "Saving…" : "Save changes"}
          </button>
          <Link href={`/pif/${programme.id}`} className="btn-secondary px-5 py-2.5 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
