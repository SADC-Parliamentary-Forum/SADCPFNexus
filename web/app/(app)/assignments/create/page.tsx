"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, tenantUsersApi, adminApi, type AssignmentType, type AssignmentPriority, type TenantUserOption, type Department } from "@/lib/api";

export default function CreateAssignmentPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    description: "",
    objective: "",
    expected_output: "",
    type: "individual" as AssignmentType,
    priority: "medium" as AssignmentPriority,
    assigned_to: "",
    department_id: "",
    due_date: "",
    start_date: "",
    checkin_frequency: "",
    is_confidential: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: usersRes } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: () => tenantUsersApi.list(),
    staleTime: 60_000,
  });
  const users: TenantUserOption[] = (usersRes?.data as any)?.data ?? usersRes?.data ?? [];

  const { data: deptsRes } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => adminApi.listDepartments(),
    staleTime: 60_000,
  });
  const departments: Department[] = (deptsRes?.data as any)?.data ?? deptsRes?.data ?? [];

  const mutation = useMutation({
    mutationFn: (payload: typeof form & { assigned_to?: number | null; department_id?: number | null }) =>
      assignmentsApi.create(payload as any),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      const id = (res.data as any).data?.id ?? (res.data as any).id;
      router.push(`/assignments/${id}`);
    },
    onError: (err: any) => {
      const errs = err?.response?.data?.errors ?? {};
      setErrors(errs);
    },
  });

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent, issue = false) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      ...form,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      department_id: form.department_id ? Number(form.department_id) : null,
      objective: form.objective || undefined,
      expected_output: form.expected_output || undefined,
      start_date: form.start_date || undefined,
      checkin_frequency: form.checkin_frequency || undefined,
    };
    mutation.mutate(payload as any);
  };

  const inputCls = (field: string) =>
    `form-input ${errors[field] ? "border-red-400 focus:ring-red-300" : ""}`;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/assignments" className="hover:text-primary">Assignments</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-700 font-medium">New Assignment</span>
      </nav>

      <div>
        <h1 className="page-title">Create Assignment</h1>
        <p className="page-subtitle">Issue a new assignment to an individual, sector, or team.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Clear, concise assignment title"
            className={inputCls("title")}
            required
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Description <span className="text-red-400">*</span></label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            placeholder="Describe what needs to be done in detail…"
            className={inputCls("description")}
            required
          />
          {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
        </div>

        {/* Objective + Expected Output */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Objective</label>
            <textarea
              value={form.objective}
              onChange={(e) => set("objective", e.target.value)}
              rows={3}
              placeholder="What should be achieved?"
              className="form-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Expected Output</label>
            <textarea
              value={form.expected_output}
              onChange={(e) => set("expected_output", e.target.value)}
              rows={3}
              placeholder="Tangible deliverable / output…"
              className="form-input"
            />
          </div>
        </div>

        {/* Type + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Assignment Type</label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className="form-input">
              <option value="individual">Individual</option>
              <option value="sector">Sector</option>
              <option value="collaborative">Collaborative</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="form-input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Assignee + Department */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Assign To</label>
            <select value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)} className="form-input">
              <option value="">— Select staff member —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.job_title ? ` — ${u.job_title}` : ""}
                </option>
              ))}
            </select>
            {errors.assigned_to && <p className="mt-1 text-xs text-red-500">{errors.assigned_to}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Department / Sector</label>
            <select value={form.department_id} onChange={(e) => set("department_id", e.target.value)} className="form-input">
              <option value="">— Select department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Due Date <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
              className={inputCls("due_date")}
              required
            />
            {errors.due_date && <p className="mt-1 text-xs text-red-500">{errors.due_date}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Check-in frequency */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Check-in Frequency</label>
          <select value={form.checkin_frequency} onChange={(e) => set("checkin_frequency", e.target.value)} className="form-input">
            <option value="">— None —</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Confidential */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_confidential}
            onChange={(e) => set("is_confidential", e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-neutral-700">Mark as Confidential</span>
        </label>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary disabled:opacity-60"
          >
            {mutation.isPending ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">save</span>
            )}
            Save as Draft
          </button>
          <Link href="/assignments" className="btn-secondary">Cancel</Link>
        </div>

        {mutation.isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Failed to create assignment. Please check the form and try again.
          </div>
        )}
      </form>
    </div>
  );
}
