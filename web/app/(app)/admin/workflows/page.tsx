"use client";

import { useState, useEffect } from "react";
import { adminApi, type ApprovalWorkflow, type ApprovalStep, type User } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function AdminWorkflowPage() {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ApprovalWorkflow> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      adminApi.listWorkflows(),
      adminApi.listUsers(),
      adminApi.listRoles(),
    ]).then(([wfRes, userRes, roleRes]) => {
      setWorkflows(wfRes.data.data);
      setUsers((userRes.data as any).data || []);
      setRoles((roleRes.data as any).roles || []);
    }).finally(() => setLoading(false));
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
      toast("success", "Workflow Saved", "The approval workflow has been saved successfully.");
    } catch (err) {
      toast("error", "Save Failed", "Failed to save the workflow configuration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Approval Workflows</h1>
          <p className="page-subtitle text-neutral-500">Configure multi-stage approval processes for system modules.</p>
        </div>
        <button
          onClick={() => setEditing({ name: "", module_type: "leave", is_active: true, steps: [] })}
          className="btn-primary"
        >
          <span className="material-symbols-outlined">add</span>
          New Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workflow List */}
        <div className="lg:col-span-1 space-y-4">
          {workflows.map(wf => (
            <div
              key={wf.id}
              onClick={() => setEditing(wf)}
              className={`card p-4 cursor-pointer transition-all border-l-4 ${editing?.id === wf.id ? "border-l-primary bg-primary/5" : "border-l-transparent hover:border-l-neutral-300"}`}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-neutral-900">{wf.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${wf.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {wf.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 capitalize">{wf.module_type}</p>
              <div className="mt-3 flex gap-1">
                {wf.steps.map((_, i) => (
                  <div key={i} className="h-1 flex-1 bg-neutral-200 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {editing ? (
            <div className="card p-6 border-primary/20 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-neutral-900">{editing.id ? "Edit Workflow" : "Create New Workflow"}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className="btn-secondary py-1.5 px-3 text-xs">Cancel</button>
                  <button onClick={saveWorkflow} className="btn-primary py-1.5 px-3 text-xs">Save Changes</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Workflow Name</label>
                  <input
                    className="input-field"
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Leave Approval Policy"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Module</label>
                  <select
                    className="input-field"
                    value={editing.module_type}
                    onChange={e => setEditing({ ...editing, module_type: e.target.value })}
                  >
                    <option value="leave">Leave</option>
                    <option value="travel">Travel</option>
                    <option value="imprest">Imprest</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Approval Steps</label>
                </div>

                {editing.steps?.map((step, idx) => (
                  <div key={idx} className="relative pl-8 pb-4">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-200" />
                    <div className="absolute left-1.5 top-2 size-3 rounded-full bg-primary border-4 border-white shadow-sm ring-1 ring-primary/20" />

                    <div className="card p-4 bg-neutral-50 border-neutral-200">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid grid-cols-3 gap-4">
                          <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-neutral-500 mb-1">Approver Type</label>
                            <select
                              className="input-field py-1 text-xs"
                              value={step.approver_type}
                              onChange={e => handleUpdateStep(idx, { approver_type: e.target.value as any })}
                            >
                              <option value="supervisor">Direct Supervisor</option>
                              <option value="up_the_chain">Head of Chain</option>
                              <option value="specific_role">Specific Role</option>
                              <option value="specific_user">Specific Individual</option>
                            </select>
                          </div>

                          <div className="col-span-2">
                            {step.approver_type === 'specific_role' && (
                              <>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Select Role</label>
                                <select
                                  className="input-field py-1 text-xs"
                                  value={step.role_id || ""}
                                  onChange={e => handleUpdateStep(idx, { role_id: parseInt(e.target.value) })}
                                >
                                  <option value="">Select Role...</option>
                                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                              </>
                            )}
                            {step.approver_type === 'specific_user' && (
                              <>
                                <label className="block text-[10px] font-bold text-neutral-500 mb-1">Select User</label>
                                <select
                                  className="input-field py-1 text-xs"
                                  value={step.user_id || ""}
                                  onChange={e => handleUpdateStep(idx, { user_id: parseInt(e.target.value) })}
                                >
                                  <option value="">Select User...</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              </>
                            )}
                            {(step.approver_type === 'supervisor' || step.approver_type === 'up_the_chain') && (
                              <p className="text-[10px] text-neutral-500 mt-5 italic">
                                Automatically determined via department hierarchy.
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
                  <span className="text-xs font-bold uppercase tracking-wider">Add Approval Stage</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-2xl py-20 px-10 text-center">
              <span className="material-symbols-outlined text-6xl opacity-20 mb-4">account_tree</span>
              <h3 className="text-lg font-bold text-neutral-500">No workflow selected</h3>
              <p className="max-w-xs mt-2">Select an existing policy or create a new one to define how approvals flow through the organisation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
