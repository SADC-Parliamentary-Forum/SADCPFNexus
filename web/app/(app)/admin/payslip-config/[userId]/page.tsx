"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { payslipConfigApi, tenantUsersApi, type PayslipLineConfig, type TenantUserOption } from "@/lib/api";

const COMPONENT_TYPES = [
  { value: "earning",              label: "Earning" },
  { value: "deduction",           label: "Deduction" },
  { value: "company_contribution",label: "Company Contribution" },
  { value: "info",                 label: "Info (non-monetary)" },
];

const KNOWN_SYSTEM_KEYS = [
  "basic_pay", "housing_allowance", "transport_allowance", "medical_allowance",
  "communication_allowance", "subsistence_allowance", "advance_recovery", "annual_leave_balance",
];

function TypeBadge({ type }: { type: string }) {
  const config: Record<string, string> = {
    earning: "badge-success",
    deduction: "badge-danger",
    company_contribution: "badge-primary",
    info: "badge-muted",
  };
  const labels: Record<string, string> = {
    earning: "Earning",
    deduction: "Deduction",
    company_contribution: "Co. Contribution",
    info: "Info",
  };
  return <span className={`text-xs ${config[type] ?? "badge-muted"}`}>{labels[type] ?? type}</span>;
}

export default function PayslipConfigPage() {
  const { userId } = useParams<{ userId: string }>();
  const uid = Number(userId);

  const [configs, setConfigs] = useState<PayslipLineConfig[]>([]);
  const [employee, setEmployee] = useState<TenantUserOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    component_key: "",
    label: "",
    component_type: "earning",
    source: "manual",
    fixed_amount: "",
    is_visible: true,
    sort_order: "0",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editInline, setEditInline] = useState<Record<number, Partial<PayslipLineConfig>>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payslipConfigApi.list(uid);
      setConfigs(res.data.data ?? []);
    } catch {
      setError("Failed to load payslip line configs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!uid) return;
    load();
    tenantUsersApi.list().then((r) => {
      const users: TenantUserOption[] = (r.data as any).data ?? r.data ?? [];
      setEmployee(users.find((u) => u.id === uid) ?? null);
    }).catch(() => {});
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateDefaults = async () => {
    setGenLoading(true);
    setGenMessage(null);
    try {
      const res = await payslipConfigApi.generateDefaults(uid);
      setGenMessage(res.data.message);
      load();
    } catch {
      setGenMessage("Failed to generate defaults.");
    } finally {
      setGenLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await payslipConfigApi.create({
        user_id: uid,
        component_key: form.component_key,
        label: form.label,
        component_type: form.component_type as PayslipLineConfig["component_type"],
        source: form.source as "system" | "manual",
        fixed_amount: form.fixed_amount ? Number(form.fixed_amount) : undefined,
        is_visible: form.is_visible,
        sort_order: Number(form.sort_order),
      });
      setShowAddModal(false);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Save failed.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const saveInline = async (id: number) => {
    const changes = editInline[id];
    if (!changes) return;
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      await payslipConfigApi.update(id, changes);
      setEditInline((e) => { const n = { ...e }; delete n[id]; return n; });
      load();
    } catch {
      // keep editing, show nothing
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remove this line from the payslip config?")) return;
    await payslipConfigApi.remove(id);
    load();
  };

  const toggleVisible = async (config: PayslipLineConfig) => {
    await payslipConfigApi.update(config.id, { is_visible: !config.is_visible });
    load();
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
        <Link href="/admin" className="hover:text-primary">Admin</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href="/admin/salary-assignments" className="hover:text-primary">Salary Assignments</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">Payslip Config</span>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Payslip Line Config</h1>
          <p className="page-subtitle">
            {employee ? `${employee.name} — ` : ""}
            Configure which lines appear on this employee&apos;s payslip and whether they are system-sourced or manually entered.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateDefaults}
            disabled={genLoading}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {genLoading ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>}
            Generate Defaults
          </button>
          <button onClick={() => { setForm({ component_key: "", label: "", component_type: "earning", source: "manual", fixed_amount: "", is_visible: true, sort_order: "0" }); setFormError(null); setShowAddModal(true); }} className="btn-primary text-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Line
          </button>
        </div>
      </div>

      {genMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">{genMessage}</div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <p className="text-xs text-neutral-500">
            <strong>{configs.length}</strong> line config{configs.length !== 1 ? "s" : ""} ·
            System-sourced values are auto-computed. Manual values are entered by HR.
          </p>
        </div>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Sort</th>
              <th>Key / Label</th>
              <th>Type</th>
              <th>Source</th>
              <th>Fixed Amount</th>
              <th>Visible</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => <td key={j}><div className="h-3 bg-neutral-100 rounded animate-pulse" /></td>)}
                </tr>
              ))
            ) : configs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <p className="text-sm text-neutral-400">No lines configured yet.</p>
                  <button onClick={handleGenerateDefaults} className="text-sm text-primary hover:underline mt-2">Generate defaults from grade band</button>
                </td>
              </tr>
            ) : configs.map((cfg) => {
              const inline = editInline[cfg.id] ?? {};
              const isEditing = cfg.id in editInline;

              return (
                <tr key={cfg.id} className="hover:bg-neutral-50">
                  <td className="text-sm text-neutral-500 w-12">
                    {isEditing ? (
                      <input type="number" min={0} className="form-input w-14 py-0.5 text-xs" value={inline.sort_order ?? cfg.sort_order}
                        onChange={(e) => setEditInline((p) => ({ ...p, [cfg.id]: { ...inline, sort_order: Number(e.target.value) } }))} />
                    ) : cfg.sort_order}
                  </td>
                  <td>
                    <div>
                      {isEditing ? (
                        <input className="form-input text-sm w-full py-0.5" value={inline.label ?? cfg.label}
                          onChange={(e) => setEditInline((p) => ({ ...p, [cfg.id]: { ...inline, label: e.target.value } }))} />
                      ) : (
                        <p className="text-sm font-medium text-neutral-900">{cfg.label}</p>
                      )}
                      <p className="text-xs text-neutral-400 font-mono">{cfg.component_key}</p>
                    </div>
                  </td>
                  <td><TypeBadge type={cfg.component_type} /></td>
                  <td>
                    <span className={`text-xs font-medium ${cfg.source === "system" ? "text-blue-600" : "text-neutral-600"}`}>
                      {cfg.source === "system" ? (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                          System
                        </span>
                      ) : "Manual"}
                    </span>
                  </td>
                  <td>
                    {cfg.source === "manual" ? (
                      isEditing ? (
                        <input type="number" min={0} step={0.01} className="form-input w-24 py-0.5 text-xs" value={inline.fixed_amount ?? cfg.fixed_amount ?? ""}
                          onChange={(e) => setEditInline((p) => ({ ...p, [cfg.id]: { ...inline, fixed_amount: e.target.value ? Number(e.target.value) : null } }))} />
                      ) : (
                        <span className="text-sm">{cfg.fixed_amount != null ? `NAD ${Number(cfg.fixed_amount).toLocaleString()}` : "—"}</span>
                      )
                    ) : (
                      <span className="text-xs text-neutral-300 italic">auto</span>
                    )}
                  </td>
                  <td>
                    <button type="button" onClick={() => toggleVisible(cfg)} title={cfg.is_visible ? "Visible (click to hide)" : "Hidden (click to show)"}
                      className={`text-${cfg.is_visible ? "green" : "neutral"}-400 hover:text-primary`}>
                      <span className="material-symbols-outlined text-[18px]">{cfg.is_visible ? "visibility" : "visibility_off"}</span>
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveInline(cfg.id)} disabled={saving[cfg.id]} className="text-xs text-green-600 font-semibold hover:underline disabled:opacity-50">
                            {saving[cfg.id] ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditInline((p) => { const n = { ...p }; delete n[cfg.id]; return n; })} className="text-xs text-neutral-400 hover:underline">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditInline((p) => ({ ...p, [cfg.id]: {} }))} className="text-xs text-primary hover:underline">Edit</button>
                          <button onClick={() => handleRemove(cfg.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add line modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">Add Payslip Line</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Component Key <span className="text-red-500">*</span></label>
                <input className="form-input w-full font-mono text-sm" placeholder="e.g. housing_allowance or custom_bonus"
                  value={form.component_key} onChange={(e) => setForm((f) => ({ ...f, component_key: e.target.value }))} required maxLength={60} />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Label <span className="text-red-500">*</span></label>
                <input className="form-input w-full" placeholder="Displayed name on payslip"
                  value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required maxLength={100} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select className="form-input w-full" value={form.component_type} onChange={(e) => setForm((f) => ({ ...f, component_type: e.target.value }))}>
                    {COMPONENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Source <span className="text-red-500">*</span></label>
                  <select className="form-input w-full" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                    <option value="manual">Manual (HR enters)</option>
                    <option value="system">System (auto-computed)</option>
                  </select>
                </div>
              </div>
              {form.source === "manual" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Fixed Amount (NAD)</label>
                  <input type="number" min={0} step={0.01} className="form-input w-full" placeholder="0.00"
                    value={form.fixed_amount} onChange={(e) => setForm((f) => ({ ...f, fixed_amount: e.target.value }))} />
                </div>
              )}
              {formError && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{formError}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
                  {submitting ? "Saving…" : "Add Line"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
