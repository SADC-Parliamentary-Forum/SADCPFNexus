"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmployeePicker } from "@/components/ui/EmployeePicker";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, adminApi, type AssignmentType, type AssignmentPriority, type TenantUserOption, type Department } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function CreateAssignmentPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();

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
  const [assignedUser, setAssignedUser] = useState<TenantUserOption | null>(null);

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
      toast.success(t("assignments.create.toast.created"));
      router.push(`/assignments/${id}`);
    },
    onError: (err: any) => {
      const errs = err?.response?.data?.errors ?? {};
      setErrors(errs);
      toast.error(t("assignments.create.toast.notCreated"), apiErrorMessage(err, t("assignments.create.toast.notCreatedDetail")));
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
    <div className="w-full min-w-0 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/assignments" className="hover:text-primary">{t("nav.assignments")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-700 font-medium">{t("assignments.newAssignment")}</span>
      </nav>

      <ModulePageHeader
        title={t("assignments.create.title")}
        subtitle={t("assignments.create.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assignments.create.title") }]} />}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="assignments-create-title" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.titleLabel")} <span className="text-red-500">*</span></label>
          <input id="assignments-create-title"
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={t("assignments.create.titlePlaceholder")}
            className={inputCls("title")}
            required
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="assignments-create-description" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.description")} <span className="text-red-500">*</span></label>
          <textarea id="assignments-create-description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            placeholder={t("assignments.create.descriptionPlaceholder")}
            className={inputCls("description")}
            required
          />
          {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
        </div>

        {/* Objective + Expected Output */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="assignments-create-objective" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.objective")}</label>
            <textarea id="assignments-create-objective"
              value={form.objective}
              onChange={(e) => set("objective", e.target.value)}
              rows={3}
              placeholder={t("assignments.create.objectivePlaceholder")}
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="assignments-create-expected-output" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.expectedOutput")}</label>
            <textarea id="assignments-create-expected-output"
              value={form.expected_output}
              onChange={(e) => set("expected_output", e.target.value)}
              rows={3}
              placeholder={t("assignments.create.expectedOutputPlaceholder")}
              className="form-input"
            />
          </div>
        </div>

        {/* Type + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="assignments-create-assignment-type" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.type")}</label>
            <select id="assignments-create-assignment-type" value={form.type} onChange={(e) => set("type", e.target.value)} className="form-input">
              <option value="individual">{t("assignments.type.individual")}</option>
              <option value="sector">{t("assignments.type.sector")}</option>
              <option value="collaborative">{t("assignments.type.collaborative")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="assignments-create-priority" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.priority")}</label>
            <select id="assignments-create-priority" value={form.priority} onChange={(e) => set("priority", e.target.value)} className="form-input">
              <option value="low">{t("assignments.priority.low")}</option>
              <option value="medium">{t("assignments.priority.medium")}</option>
              <option value="high">{t("assignments.priority.high")}</option>
              <option value="critical">{t("assignments.priority.critical")}</option>
            </select>
          </div>
        </div>

        {/* Assignee + Department */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <EmployeePicker
              id="assignments-create-assign-to"
              label={t("assignments.create.assignTo")}
              value={assignedUser}
              onSelect={(u) => {
                setAssignedUser(u);
                set("assigned_to", u ? String(u.id) : "");
              }}
              placeholder={t("assignments.create.assignToPlaceholder")}
            />
            {errors.assigned_to && <p className="mt-1 text-xs text-red-500">{errors.assigned_to}</p>}
          </div>
          <div>
            <label htmlFor="assignments-create-department-sector" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.department")}</label>
            <select id="assignments-create-department-sector" value={form.department_id} onChange={(e) => set("department_id", e.target.value)} className="form-input">
              <option value="">{t("assignments.create.selectDepartment")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="assignments-create-due-date" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.dueDate")} <span className="text-red-500">*</span></label>
            <input id="assignments-create-due-date"
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
              className={inputCls("due_date")}
              required
            />
            {errors.due_date && <p className="mt-1 text-xs text-red-500">{errors.due_date}</p>}
          </div>
          <div>
            <label htmlFor="assignments-create-start-date" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.startDate")}</label>
            <input id="assignments-create-start-date"
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Check-in frequency */}
        <div>
          <label htmlFor="assignments-create-check-in-frequency" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.checkinFrequency")}</label>
          <select id="assignments-create-check-in-frequency" value={form.checkin_frequency} onChange={(e) => set("checkin_frequency", e.target.value)} className="form-input">
            <option value="">{t("assignments.create.none")}</option>
            <option value="daily">{t("assignments.frequency.daily")}</option>
            <option value="weekly">{t("assignments.frequency.weekly")}</option>
            <option value="biweekly">{t("assignments.frequency.biweekly")}</option>
            <option value="monthly">{t("assignments.frequency.monthly")}</option>
          </select>
        </div>

        {/* Confidential */}
        <label htmlFor="assignments-create-set-is-confidential-e-target-checked-classname-h" className="flex items-center gap-3 cursor-pointer select-none">
          <input id="assignments-create-set-is-confidential-e-target-checked-classname-h"
            type="checkbox"
            checked={form.is_confidential}
            onChange={(e) => set("is_confidential", e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-neutral-700">{t("assignments.create.confidential")}</span>
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
            {t("assignments.create.saveDraft")}
          </button>
          <Link href="/assignments" className="btn-secondary">{t("common.cancel")}</Link>
        </div>

        {mutation.isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {t("assignments.create.failed")}
          </div>
        )}
      </form>
    </div>
  );
}
