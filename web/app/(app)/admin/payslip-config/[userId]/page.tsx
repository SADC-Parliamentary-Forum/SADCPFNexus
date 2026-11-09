"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { payslipConfigApi, tenantUsersApi, type PayslipLineConfig, type TenantUserOption } from "@/lib/api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TableEmpty } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const COMPONENT_TYPES = [
  { value: "earning",              label: "admin.payslipConfig.type.earning" },
  { value: "deduction",            label: "admin.payslipConfig.type.deduction" },
  { value: "company_contribution", label: "admin.payslipConfig.type.contribution" },
  { value: "info",                 label: "admin.payslipConfig.type.infoLong" },
];

const KNOWN_SYSTEM_KEYS = [
  "basic_pay", "housing_allowance", "transport_allowance", "medical_allowance",
  "communication_allowance", "subsistence_allowance", "advance_recovery", "annual_leave_balance",
];

function TypeBadge({ type }: { type: string }) {
  const { t } = useI18n();
  const config: Record<string, string> = {
    earning: "badge-success",
    deduction: "badge-danger",
    company_contribution: "badge-primary",
    info: "badge-muted",
  };
  const labels: Record<string, string> = {
    earning: "admin.payslipConfig.type.earning",
    deduction: "admin.payslipConfig.type.deduction",
    company_contribution: "admin.payslipConfig.type.coContribution",
    info: "admin.payslipConfig.type.info",
  };
  return <span className={`text-xs ${config[type] ?? "badge-muted"}`}>{labels[type] ? t(labels[type]) : type}</span>;
}

export default function PayslipConfigPage() {
  const { t } = useI18n();
  const { userId } = useParams<{ userId: string }>();
  const uid = Number(userId);
  const { confirm } = useConfirm();
  const toast = useToast();

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
      setError(t("admin.payslipConfig.loadFailed"));
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
      toast.success(t("admin.payslipConfig.generated"), res.data.message);
      load();
    } catch (err) {
      setGenMessage(t("admin.payslipConfig.generateFailed"));
      toast.error(t("admin.payslipConfig.generateFailedTitle"), apiErrorMessage(err, t("admin.payslipConfig.generateFailed")));
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
      toast.success(t("admin.payslipConfig.added"));
      setShowAddModal(false);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("admin.salary.saveFailed");
      setFormError(msg);
      toast.error(t("admin.payslipConfig.notAdded"), apiErrorMessage(e, t("admin.salary.saveFailed")));
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
      toast.success(t("admin.payslipConfig.saved"));
      load();
    } catch (err) {
      // keep editing
      toast.error(t("admin.payslipConfig.notSaved"), apiErrorMessage(err, t("admin.salary.saveFailed")));
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const handleRemove = async (id: number) => {
    if (
      !(await confirm({
        title: t("admin.payslipConfig.removeTitle"),
        message: t("admin.payslipConfig.removeMessage"),
        variant: "danger",
      }))
    ) return;
    try {
      await payslipConfigApi.remove(id);
      toast.success(t("admin.payslipConfig.removed"));
      load();
    } catch (err) {
      toast.error(t("admin.payslipConfig.removeFailedTitle"), apiErrorMessage(err, t("admin.payslipConfig.removeFailed")));
    }
  };

  const toggleVisible = async (config: PayslipLineConfig) => {
    try {
      await payslipConfigApi.update(config.id, { is_visible: !config.is_visible });
      toast.success(config.is_visible ? t("admin.payslipConfig.hidden") : t("admin.payslipConfig.shown"));
      load();
    } catch (err) {
      toast.error(t("admin.payslipConfig.visibilityFailed"), apiErrorMessage(err, t("admin.payslipConfig.updateFailed")));
    }
  };

  return (
    <div className="w-full min-w-0 p-6 space-y-5">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
        <Link href="/admin" className="hover:text-primary">{t("admin.homeLabel")}</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href="/admin/salary-assignments" className="hover:text-primary">{t("admin.salary.crumb")}</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">{t("admin.payslipConfig.crumb")}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
          title={t("admin.payslipConfig.title")}
          subtitle={t("admin.payslipConfig.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.payslipConfig.title") }]} />}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateDefaults}
            disabled={genLoading}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {genLoading ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>}
            {t("admin.payslipConfig.generate")}
          </button>
          <button onClick={() => { setForm({ component_key: "", label: "", component_type: "earning", source: "manual", fixed_amount: "", is_visible: true, sort_order: "0" }); setFormError(null); setShowAddModal(true); }} className="btn-primary text-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">add</span>
            {t("admin.payslipConfig.addLine")}
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
            {t(configs.length !== 1 ? "admin.payslipConfig.countMany" : "admin.payslipConfig.countOne", { count: configs.length })} ·{" "}
            {t("admin.payslipConfig.sourceHint")}
          </p>
        </div>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>{t("admin.payslipConfig.colSort")}</th>
              <th>{t("admin.payslipConfig.colKeyLabel")}</th>
              <th>{t("admin.common.type")}</th>
              <th>{t("admin.payslipConfig.colSource")}</th>
              <th>{t("admin.payslipConfig.colFixed")}</th>
              <th>{t("admin.payslipConfig.colVisible")}</th>
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
              <TableEmpty
                colSpan={7}
                title={t("admin.payslipConfig.empty")}
                action={
                  <button type="button" onClick={handleGenerateDefaults} className="btn-secondary text-sm py-1 px-2">
                    {t("admin.payslipConfig.generateFromBand")}
                  </button>
                }
              />
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
                          {t("admin.payslipConfig.system")}
                        </span>
                      ) : t("admin.payslipConfig.manual")}
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
                      <span className="text-xs text-neutral-300 italic">{t("admin.payslipConfig.auto")}</span>
                    )}
                  </td>
                  <td>
                    <button type="button" onClick={() => toggleVisible(cfg)} title={cfg.is_visible ? t("admin.payslipConfig.visibleHint") : t("admin.payslipConfig.hiddenHint")}
                      className={`text-${cfg.is_visible ? "green" : "neutral"}-400 hover:text-primary`}>
                      <span className="material-symbols-outlined text-[18px]">{cfg.is_visible ? "visibility" : "visibility_off"}</span>
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveInline(cfg.id)} disabled={saving[cfg.id]} className="btn-secondary text-xs py-1 px-2 text-green-700 disabled:opacity-50">
                            {saving[cfg.id] ? "…" : t("common.save")}
                          </button>
                          <button onClick={() => setEditInline((p) => { const n = { ...p }; delete n[cfg.id]; return n; })} className="btn-secondary text-xs py-1 px-2">
                            {t("common.cancel")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditInline((p) => ({ ...p, [cfg.id]: {} }))} className="btn-secondary text-xs py-1 px-2">{t("common.edit")}</button>
                          <button onClick={() => handleRemove(cfg.id)} className="btn-secondary text-xs py-1 px-2 text-red-600">{t("admin.salary.remove")}</button>
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
        <Modal open title={t("admin.payslipConfig.addTitle")} onClose={() => setShowAddModal(false)} size="md">
          <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-payslip-config-user-component-key" className="block text-sm font-medium text-neutral-700 mb-1">{t("admin.payslipConfig.componentKey")} <span className="text-red-500">*</span></label>
                <input id="admin-payslip-config-user-component-key" className="form-input w-full font-mono text-sm" placeholder={t("admin.payslipConfig.componentKeyPlaceholder")}
                  value={form.component_key} onChange={(e) => setForm((f) => ({ ...f, component_key: e.target.value }))} required maxLength={60} />
              </div>
              <div>
                <label htmlFor="admin-payslip-config-user-label" className="block text-sm font-medium text-neutral-700 mb-1">{t("admin.timesheetProjects.label")} <span className="text-red-500">*</span></label>
                <input id="admin-payslip-config-user-label" className="form-input w-full" placeholder={t("admin.payslipConfig.labelPlaceholder")}
                  value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required maxLength={100} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-payslip-config-user-type" className="block text-sm font-medium text-neutral-700 mb-1">{t("admin.common.type")} <span className="text-red-500">*</span></label>
                  <select id="admin-payslip-config-user-type" className="form-input w-full" value={form.component_type} onChange={(e) => setForm((f) => ({ ...f, component_type: e.target.value }))}>
                    {COMPONENT_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{t(ct.label)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-payslip-config-user-source" className="block text-sm font-medium text-neutral-700 mb-1">{t("admin.payslipConfig.colSource")} <span className="text-red-500">*</span></label>
                  <select id="admin-payslip-config-user-source" className="form-input w-full" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                    <option value="manual">{t("admin.payslipConfig.manualLong")}</option>
                    <option value="system">{t("admin.payslipConfig.systemLong")}</option>
                  </select>
                </div>
              </div>
              {form.source === "manual" && (
                <div>
                  <label htmlFor="admin-payslip-config-user-fixed-amount-nad" className="block text-sm font-medium text-neutral-700 mb-1">{t("admin.payslipConfig.fixedNad")}</label>
                  <input id="admin-payslip-config-user-fixed-amount-nad" type="number" min={0} step={0.01} className="form-input w-full" placeholder="0.00"
                    value={form.fixed_amount} onChange={(e) => setForm((f) => ({ ...f, fixed_amount: e.target.value }))} />
                </div>
              )}
              {formError && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{formError}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary text-sm">{t("common.cancel")}</button>
                <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
                  {submitting ? t("admin.common.saving") : t("admin.payslipConfig.addLine")}
                </button>
              </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
