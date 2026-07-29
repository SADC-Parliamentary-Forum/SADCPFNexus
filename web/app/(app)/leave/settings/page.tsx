"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { leaveApi, type LeavePolicyVersion } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const MODES = [
  { value: "standard", label: "Standard (HOD → HR → SG)" },
  { value: "finance_first", label: "Finance-first (Finance → HR → SG)" },
  { value: "director_principal", label: "Director-principal (HOD → HR → Director → SG)" },
];

export default function LeaveSettingsPage() {
  const [policies, setPolicies] = useState<LeavePolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    version: "",
    effective_from: "",
    workflow_mode: "standard",
    admin_review_required: false,
    change_reason: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await leaveApi.listPolicies();
      setPolicies(res.data.data ?? []);
    } catch {
      setError("Failed to load leave policy versions. HR Manager / HR Administrator required.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await leaveApi.createPolicy({
        ...form,
        admin_review_required:
          form.workflow_mode === "director_principal" ? true : form.admin_review_required,
        principal_role: "Director",
        final_approver_role: "Secretary General",
      });
      setForm({
        version: "",
        effective_from: "",
        workflow_mode: "standard",
        admin_review_required: false,
        change_reason: "",
      });
      await load();
    } catch {
      setError("Could not create policy version. Provide a change reason and HR admin access.");
    } finally {
      setSaving(false);
    }
  };

  const active = policies.find((p) => p.is_active);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/leave" className="hover:text-primary transition-colors">
          Leave
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Workflow settings</span>
      </div>

      <div>
        <h1 className="page-title">Leave workflow settings</h1>
        <p className="page-subtitle">
          Configure Finance-first and Director-principal routing. Versions are immutable — create a new
          version to change mode.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      ) : (
        <>
          <div className="card space-y-2 p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Active policy</h2>
            {active ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-neutral-500">Version</dt>
                  <dd className="font-medium">{active.version}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Mode</dt>
                  <dd className="font-medium">{active.workflow_mode ?? "standard"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Principal review</dt>
                  <dd className="font-medium">{active.admin_review_required ? "Director" : "Off"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Effective from</dt>
                  <dd className="font-medium">
                    {active.effective_from ? formatDate(active.effective_from) : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-neutral-500">No active policy yet.</p>
            )}
          </div>

          <form onSubmit={createVersion} className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Create new policy version</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Version</label>
                <input
                  className="form-input"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="v2"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Effective from</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.effective_from}
                  onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Workflow mode</label>
                <select
                  className="form-input"
                  value={form.workflow_mode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      workflow_mode: e.target.value,
                      admin_review_required: e.target.value === "director_principal",
                    })
                  }
                >
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={form.admin_review_required || form.workflow_mode === "director_principal"}
                    onChange={(e) => setForm({ ...form, admin_review_required: e.target.checked })}
                    disabled={form.workflow_mode === "director_principal"}
                  />
                  Principal review required (Director)
                </label>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-neutral-700">Change reason</label>
                <textarea
                  className="form-input resize-none"
                  rows={2}
                  value={form.change_reason}
                  onChange={(e) => setForm({ ...form, change_reason: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Activate new version"}
            </button>
          </form>

          <div className="card p-6">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Version history</h2>
            <ul className="divide-y divide-neutral-100 text-sm">
              {policies.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span>
                    {p.version} · {p.workflow_mode ?? "standard"}
                    {p.is_active ? " · active" : ""}
                  </span>
                  <span className="text-neutral-500">
                    {p.effective_from ? formatDate(p.effective_from) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
