"use client";

import { useState, useEffect } from "react";
import { adminApi, programmeApi, type ApprovalWorkflow, type ApprovalStep, type User, type Department, type Programme } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// Fallback list used only if the backend module catalogue cannot be loaded.
// Labels are catalog keys; labels from the backend catalogue are shown as sent.
const FALLBACK_LABEL_PREFIX = "admin.workflows.module.";
const FALLBACK_MODULE_OPTIONS = [
  { value: "leave",          label: "admin.workflows.module.leave" },
  { value: "travel",         label: "admin.workflows.module.travel" },
  { value: "imprest",        label: "admin.workflows.module.imprest" },
  { value: "correspondence", label: "admin.workflows.module.correspondence" },
  { value: "procurement",    label: "admin.workflows.module.procurement" },
  { value: "finance",        label: "admin.workflows.module.finance" },
  { value: "hr",             label: "admin.workflows.module.hr" },
  { value: "governance",     label: "admin.workflows.module.governance" },
  { value: "programmes",     label: "admin.workflows.module.programmes" },
];

export default function AdminWorkflowPage() {
  const { t } = useI18n();
  const optionLabel = (label: string) => (label.startsWith(FALLBACK_LABEL_PREFIX) ? t(label) : label);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ApprovalWorkflow> | null>(null);
  const [moduleOptions, setModuleOptions] = useState<{ value: string; label: string }[]>(FALLBACK_MODULE_OPTIONS);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    Promise.all([
      adminApi.listWorkflows(),
      adminApi.listUsers(),
      adminApi.listRoles(),
      adminApi.listDepartments(),
      programmeApi.list({ per_page: 200 } as any),
    ]).then(([wfRes, userRes, roleRes, deptRes, progRes]) => {
      setWorkflows(wfRes.data.data);
      setUsers((userRes.data as any).data || []);
      setRoles((roleRes.data as any).roles || []);
      setDepartments((deptRes.data as any).data || []);
      setProgrammes((progRes.data as any).data || []);
    }).finally(() => setLoading(false));

    // Source the full module catalogue from the backend (all workflow-able
    // modules unioned with any already configured), so every module is editable.
    adminApi.workflowModuleCatalogue()
      .then((res) => {
        const opts = res.data.data ?? [];
        if (opts.length > 0) setModuleOptions(opts);
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  const handleAddStep = () => {
    if (!editing) return;
    const newStep: Partial<ApprovalStep> = {
      approver_type: "supervisor",
      step_order: (editing.steps?.length || 0),
    };
    setEditing({ ...editing, steps: [...(editing.steps || []), newStep as ApprovalStep] });
  };

  const handleUpdateStep = (index: number, updates: Partial<ApprovalStep>) => {
    if (!editing || !editing.steps) return;
    const newSteps = [...editing.steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setEditing({ ...editing, steps: newSteps });
  };

  const handleRemoveStep = (index: number) => {
    if (!editing || !editing.steps) return;
    const newSteps = editing.steps.filter((_, i) => i !== index);
    setEditing({ ...editing, steps: newSteps });
  };

  const saveWorkflow = async () => {
    if (!editing || !editing.name || !editing.module_type) return;
    setLoading(true);
    try {
      if (editing.id) {
        await adminApi.updateWorkflow(editing.id, editing);
      } else {
        await adminApi.createWorkflow(editing);
      }
      const res = await adminApi.listWorkflows();
      setWorkflows(res.data.data);
      setEditing(null);
      toast("success", t("admin.workflows.saved"), t("admin.workflows.savedDesc"));
    } catch {
      toast("error", t("admin.workflows.saveFailed"), t("admin.workflows.saveFailedDesc"));
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkflow = async () => {
    if (
      !editing?.id ||
      !(await confirm({
        title: t("admin.workflows.deleteTitle"),
        message: t("admin.workflows.deleteMessage"),
        variant: "danger",
      }))
    ) return; // ship-safe-ignore
    setLoading(true);
    try {
      await adminApi.deleteWorkflow(editing.id);
      const res = await adminApi.listWorkflows();
      setWorkflows(res.data.data);
      setEditing(null);
      toast("success", t("admin.workflows.deleted"), t("admin.workflows.deletedDesc"));
    } catch {
      toast("error", t("admin.workflows.deleteFailed"), t("admin.workflows.deleteFailedDesc"));
    } finally {
      setLoading(false);
    }
  };

  function targetLabel(wf: ApprovalWorkflow) {
    if (!wf.target_type || !wf.target_id) return null;
    if (wf.target_type === "department") {
      const dept = departments.find((d) => d.id === wf.target_id);
      return dept ? t("admin.workflows.forName", { name: dept.name }) : t("admin.workflows.deptN", { id: wf.target_id });
    }
    if (wf.target_type === "programme") {
      const prog = programmes.find((p) => p.id === wf.target_id);
      return prog ? t("admin.workflows.forName", { name: prog.title }) : t("admin.workflows.programmeN", { id: wf.target_id });
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title={t("admin.home.approvalWorkflows")}
        subtitle={t("admin.workflows.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.home.approvalWorkflows") },
            ]}
          />
        }
        actions={
          <button
            type="button"
            onClick={() => setEditing({ name: "", module_type: "leave", is_active: true, steps: [], target_type: null, target_id: null })}
            className="btn-primary"
          >
            <span className="material-symbols-outlined">add</span>
            {t("admin.workflows.new")}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workflow List */}
        <div className="lg:col-span-1 space-y-4">
          {workflows.map(wf => {
            const tLabel = targetLabel(wf);
            return (
              <div
                key={wf.id}
                onClick={() => setEditing(wf)}
                className={`card p-4 cursor-pointer transition-all border-l-4 ${editing?.id === wf.id ? "border-l-primary bg-primary/5" : "border-l-transparent hover:border-l-neutral-300"}`}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-neutral-900">{wf.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${wf.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                    {wf.is_active ? t("admin.common.active") : t("admin.common.inactive")}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1 capitalize">{optionLabel(moduleOptions.find(m => m.value === wf.module_type)?.label ?? wf.module_type)}</p>
                {tLabel && (
                  <span className="inline-block mt-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5">
                    {tLabel}
                  </span>
                )}
                <div className="mt-3 flex gap-1">
                  {wf.steps.map((_, i) => (
                    <div key={i} className="h-1 flex-1 bg-neutral-200 rounded-full" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {editing ? (
            <div className="card p-6 border-primary/20 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-neutral-900">{editing.id ? t("admin.workflows.edit") : t("admin.workflows.create")}</h2>
                <div className="flex gap-2">
                  {editing.id && (
                    <button onClick={deleteWorkflow} className="btn-secondary py-1.5 px-3 text-xs text-red-600 hover:bg-red-50 border-red-200">{t("common.delete")}</button>
                  )}
                  <button onClick={() => setEditing(null)} className="btn-secondary py-1.5 px-3 text-xs">{t("common.cancel")}</button>
                  <button onClick={saveWorkflow} className="btn-primary py-1.5 px-3 text-xs">{t("admin.governance.saveChanges")}</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="admin-workflows-workflow-name" className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">{t("admin.workflows.name")}</label>
                  <input id="admin-workflows-workflow-name"
                    className="form-input"
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder={t("admin.workflows.namePlaceholder")}
                  />
                </div>
                <div>
                  <label htmlFor="admin-workflows-module" className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">{t("admin.common.module")}</label>
                  <select id="admin-workflows-module"
                    className="form-input"
                    value={editing.module_type}
                    onChange={e => setEditing({ ...editing, module_type: e.target.value })}
                  >
                    {moduleOptions.map(m => (
                      <option key={m.value} value={m.value}>{optionLabel(m.label)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Targeting */}
              <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                <div>
                  <label htmlFor="admin-workflows-applicability" className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">{t("admin.workflows.applicability")}</label>
                  <select id="admin-workflows-applicability"
                    className="form-input"
                    value={editing.target_type ?? ""}
                    onChange={e => setEditing({ ...editing, target_type: (e.target.value as "programme" | "department") || null, target_id: null })}
                  >
                    <option value="">{t("admin.workflows.allNoRestriction")}</option>
                    <option value="department">{t("admin.workflows.specificDept")}</option>
                    <option value="programme">{t("admin.workflows.specificProgramme")}</option>
                  </select>
                </div>
                {editing.target_type === "department" && (
                  <div>
                    <label htmlFor="admin-workflows-department" className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">{t("admin.common.department")}</label>
                    <select id="admin-workflows-department"
                      className="form-input"
                      value={editing.target_id ?? ""}
                      onChange={e => setEditing({ ...editing, target_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">{t("admin.workflows.selectDept")}</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {editing.target_type === "programme" && (
                  <div>
                    <label htmlFor="admin-workflows-programme" className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">{t("admin.workflows.programme")}</label>
                    <select id="admin-workflows-programme"
                      className="form-input"
                      value={editing.target_id ?? ""}
                      onChange={e => setEditing({ ...editing, target_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">{t("admin.workflows.selectProgramme")}</option>
                      {programmes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">{t("admin.workflows.steps")}</p>
                </div>

                {editing.steps?.map((step, idx) => (
                  <div key={idx} className="relative pl-8 pb-4">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-200" />
                    <div className="absolute left-1.5 top-2 size-3 rounded-full bg-primary border-4 border-white shadow-sm ring-1 ring-primary/20" />

                    <div className="card p-4 bg-neutral-50 border-neutral-200">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid grid-cols-3 gap-4">
                          <div className="col-span-1">
                            <label htmlFor="admin-workflows-approver-type" className="block text-[10px] font-bold text-neutral-500 mb-1">{t("admin.workflows.approverType")}</label>
                            <select id="admin-workflows-approver-type"
                              className="form-input py-1 text-xs"
                              value={step.approver_type}
                              onChange={e => handleUpdateStep(idx, { approver_type: e.target.value as any })}
                            >
                              <option value="supervisor">{t("admin.workflows.approver.supervisor")}</option>
                              <option value="up_the_chain">{t("admin.workflows.approver.chain")}</option>
                              <option value="specific_role">{t("admin.workflows.approver.role")}</option>
                              <option value="specific_user">{t("admin.workflows.approver.user")}</option>
                            </select>
                          </div>

                          <div className="col-span-2">
                            {step.approver_type === 'specific_role' && (
                              <>
                                <label htmlFor={`admin-workflows-select-role-${idx}`} className="block text-[10px] font-bold text-neutral-500 mb-1">{t("admin.workflows.selectRole")}</label>
                                <select id={`admin-workflows-select-role-${idx}`}
                                  className="form-input py-1 text-xs"
                                  value={step.role_id || ""}
                                  onChange={e => handleUpdateStep(idx, { role_id: parseInt(e.target.value) })}
                                >
                                  <option value="">{t("admin.workflows.selectRoleDots")}</option>
                                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                              </>
                            )}
                            {step.approver_type === 'specific_user' && (
                              <>
                                <label htmlFor={`admin-workflows-select-user-${idx}`} className="block text-[10px] font-bold text-neutral-500 mb-1">{t("admin.workflows.selectUser")}</label>
                                <select id={`admin-workflows-select-user-${idx}`}
                                  className="form-input py-1 text-xs"
                                  value={step.user_id || ""}
                                  onChange={e => handleUpdateStep(idx, { user_id: parseInt(e.target.value) })}
                                >
                                  <option value="">{t("admin.workflows.selectUserDots")}</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              </>
                            )}
                            {(step.approver_type === 'supervisor' || step.approver_type === 'up_the_chain') && (
                              <p className="text-[10px] text-neutral-500 mt-5 italic">
                                {t("admin.workflows.autoHierarchy")}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStep(idx)}
                          className="text-neutral-400 hover:text-red-500 transition-colors pt-5"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleAddStep}
                  className="w-full py-4 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-400 hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{t("admin.workflows.addStage")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-2xl py-20 px-10 text-center">
              <span className="material-symbols-outlined text-6xl opacity-20 mb-4">account_tree</span>
              <h3 className="text-lg font-bold text-neutral-500">{t("admin.workflows.noneSelected")}</h3>
              <p className="max-w-xs mt-2">{t("admin.workflows.noneSelectedDesc")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
