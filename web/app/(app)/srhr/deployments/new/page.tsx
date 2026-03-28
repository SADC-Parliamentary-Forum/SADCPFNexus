"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { deploymentsApi, parliamentsApi, adminApi, type Parliament } from "@/lib/api";

function NewDeploymentPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [parliaments, setParliaments] = useState<Parliament[]>([]);
  const [users, setUsers]             = useState<{ id: number; name: string; email: string }[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [form, setForm] = useState({
    employee_id:        "" as string | number,
    parliament_id:      searchParams.get("parliament_id") ?? "" as string | number,
    deployment_type:    "field_researcher",
    research_area:      "",
    research_focus:     "",
    start_date:         "",
    end_date:           "",
    supervisor_name:    "",
    supervisor_title:   "",
    supervisor_email:   "",
    supervisor_phone:   "",
    terms_of_reference: "",
    notes:              "",
  });

  useEffect(() => {
    parliamentsApi.list({ is_active: true, per_page: 50 }).then((res) => {
      setParliaments(res.data.data ?? []);
    });
    adminApi.listUsers({ per_page: 200 })
      .then((res) => setUsers(res.data.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await deploymentsApi.create({
        employee_id:        Number(form.employee_id),
        parliament_id:      Number(form.parliament_id),
        deployment_type:    form.deployment_type,
        research_area:      form.research_area || undefined,
        research_focus:     form.research_focus || undefined,
        start_date:         form.start_date,
        end_date:           form.end_date || undefined,
        supervisor_name:    form.supervisor_name || undefined,
        supervisor_title:   form.supervisor_title || undefined,
        supervisor_email:   form.supervisor_email || undefined,
        supervisor_phone:   form.supervisor_phone || undefined,
        terms_of_reference: form.terms_of_reference || undefined,
        notes:              form.notes || undefined,
      });
      router.push("/srhr/deployments");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = e.response?.data?.errors
        ? Object.values(e.response.data.errors).flat().join("; ")
        : (e.response?.data?.message ?? "Failed to create deployment.");
      setError(msgs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/srhr" className="hover:text-primary">SRHR</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/srhr/deployments" className="hover:text-primary">Deployments</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">New Deployment</span>
      </div>

      <div>
        <h1 className="page-title">New Field Deployment</h1>
        <p className="page-subtitle">Deploy a researcher to a member state parliament.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Researcher <span className="text-red-500">*</span></label>
            <select className="form-input" value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} required>
              <option value="">Select researcher…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Parliament <span className="text-red-500">*</span></label>
            <select className="form-input" value={form.parliament_id} onChange={(e) => set("parliament_id", e.target.value)} required>
              <option value="">Select parliament…</option>
              {parliaments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Deployment Type</label>
            <select className="form-input" value={form.deployment_type} onChange={(e) => set("deployment_type", e.target.value)}>
              <option value="field_researcher">Field Researcher</option>
              <option value="secondment">Secondment</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Research Area</label>
            <select className="form-input" value={form.research_area} onChange={(e) => set("research_area", e.target.value)}>
              <option value="">Select area…</option>
              <option value="SRHR">SRHR</option>
              <option value="Gender & Equality">Gender &amp; Equality</option>
              <option value="Governance">Governance</option>
              <option value="Elections & Democracy">Elections &amp; Democracy</option>
              <option value="Budget & Finance">Budget &amp; Finance</option>
              <option value="Environment">Environment</option>
              <option value="Youth">Youth</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Start Date <span className="text-red-500">*</span></label>
            <input type="date" className="form-input" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">End Date <span className="text-neutral-400">(optional)</span></label>
            <input type="date" className="form-input" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </div>

        <hr className="border-neutral-100" />
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Supervisor at Parliament</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Supervisor Name</label>
            <input className="form-input" placeholder="e.g. Hon. Grace Mutasa" value={form.supervisor_name} onChange={(e) => set("supervisor_name", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Supervisor Title</label>
            <input className="form-input" placeholder="e.g. Committee Chairperson" value={form.supervisor_title} onChange={(e) => set("supervisor_title", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Supervisor Email</label>
            <input type="email" className="form-input" value={form.supervisor_email} onChange={(e) => set("supervisor_email", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Supervisor Phone</label>
            <input className="form-input" placeholder="+263…" value={form.supervisor_phone} onChange={(e) => set("supervisor_phone", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Research Focus <span className="text-neutral-400">(optional)</span></label>
          <textarea className="form-input" rows={2} placeholder="Describe the specific research scope and objectives…" value={form.research_focus} onChange={(e) => set("research_focus", e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Terms of Reference</label>
          <textarea className="form-input" rows={4} placeholder="Summarise the researcher's mandate and key responsibilities…" value={form.terms_of_reference} onChange={(e) => set("terms_of_reference", e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Notes</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/srhr/deployments" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create Deployment"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewDeploymentPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl p-6 text-sm text-neutral-500">Loading…</div>}>
      <NewDeploymentPageInner />
    </Suspense>
  );
}
