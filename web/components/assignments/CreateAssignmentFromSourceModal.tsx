"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { assignmentsApi, tenantUsersApi, type AssignmentPriority, type TenantUserOption } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  sourceType: string;
  sourceId: number;
  sourcePurpose?: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultDueDate?: string | null;
  defaultAssigneeId?: number | null;
  sourceConfidential?: boolean;
  sourceReference?: string | null;
  sourceTitle?: string | null;
};

export function CreateAssignmentFromSourceModal({
  open,
  onClose,
  sourceType,
  sourceId,
  sourcePurpose = "action",
  defaultTitle,
  defaultDescription = "",
  defaultDueDate,
  defaultAssigneeId,
  sourceConfidential = false,
  sourceReference,
  sourceTitle,
}: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription || defaultTitle);
  const [dueDate, setDueDate] = useState(defaultDueDate ?? "");
  const [assignedTo, setAssignedTo] = useState(defaultAssigneeId ? String(defaultAssigneeId) : "");
  const [priority, setPriority] = useState<AssignmentPriority>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setDescription(defaultDescription || defaultTitle);
    setDueDate(defaultDueDate ?? "");
    setAssignedTo(defaultAssigneeId ? String(defaultAssigneeId) : "");
    setError(null);
    tenantUsersApi.list().then((r) => setUsers(r.data.data ?? [])).catch(() => setUsers([]));
  }, [open, defaultTitle, defaultDescription, defaultDueDate, defaultAssigneeId]);

  if (!open) return null;

  async function handleCreate() {
    if (!title.trim() || !description.trim() || !dueDate) {
      setError("Title, description, and due date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await assignmentsApi.fromSource({
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate,
        assigned_to: assignedTo ? Number(assignedTo) : undefined,
        priority,
        source_type: sourceType,
        source_id: sourceId,
        source_purpose: sourcePurpose,
        source_confidential: sourceConfidential,
        source_reference: sourceReference ?? undefined,
        source_title: sourceTitle ?? defaultTitle,
      });
      const id = (res.data as { data?: { id?: number } }).data?.id;
      onClose();
      if (id) router.push(`/assignments/${id}`);
    } catch {
      setError("Could not create assignment from this source.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">Create Assignment from Source</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-neutral-500">
            Links a tracked assignment via <code className="text-[11px]">POST /assignments/from-source</code> ({sourceType} #{sourceId}).
          </p>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
            <textarea className="form-input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Due date</label>
              <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
              <select className="form-input" value={priority} onChange={(e) => setPriority(e.target.value as AssignmentPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Assignee</label>
            <select className="form-input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">— Unassigned / department claim —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => void handleCreate()} disabled={submitting} className="btn-primary disabled:opacity-60">
            <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
            {submitting ? "Creating…" : "Create Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
