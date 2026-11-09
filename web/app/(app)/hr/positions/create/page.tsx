"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { positionsApi, adminApi, type Department } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const GRADES = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"];

export default function CreatePositionPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();

  const [form, setForm] = useState({
    department_id: "",
    title: "",
    grade: "",
    description: "",
    headcount: "1",
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: deptsRes } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => adminApi.listDepartments(),
    staleTime: 60_000,
  });
  const departments: Department[] = (deptsRes?.data as any)?.data ?? deptsRes?.data ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      positionsApi.create({
        department_id: Number(form.department_id),
        title: form.title.trim(),
        grade: form.grade || undefined,
        description: form.description.trim() || undefined,
        headcount: Number(form.headcount),
        is_active: form.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-positions"] });
      toast.success(t("hr.positions.form.created"));
      router.push("/hr/positions");
    },
    onError: (err: any) => {
      toast.error(t("hr.positions.form.notCreated"), apiErrorMessage(err, t("hr.positions.form.createFailed")));
      const data = err?.response?.data;
      if (data?.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.errors)) {
          mapped[k] = Array.isArray(v) ? (v as string[])[0] : String(v);
        }
        setErrors(mapped);
      } else {
        setErrors({ _global: data?.message ?? t("hr.positions.form.createFailed") });
      }
    },
  });

  function set(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.department_id) errs.department_id = t("hr.positions.form.departmentRequired");
    if (!form.title.trim()) errs.title = t("hr.positions.form.titleRequired");
    if (Number(form.headcount) < 1) errs.headcount = t("hr.positions.form.headcountMin");
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    mutation.mutate();
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.positions.newPosition"
        subtitle="hr.positions.form.createSubtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.positions.crumb", href: "/hr/positions" },
              { label: "hr.positions.newPosition" },
            ]}
          />
        }
      />

      {errors._global && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
          {errors._global}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Department */}
        <div>
          <label htmlFor="hr-positions-create-department" className="block text-sm font-medium text-neutral-700 mb-1.5">
            {t("hr.positions.form.department")} <span className="text-red-500">*</span>
          </label>
          <select id="hr-positions-create-department"
            value={form.department_id}
            onChange={(e) => set("department_id", e.target.value)}
            className={`form-input w-full ${errors.department_id ? "border-red-400" : ""}`}
          >
            <option value="">{t("hr.positions.form.selectDepartment")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {errors.department_id && <p className="text-xs text-red-500 mt-1">{errors.department_id}</p>}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="hr-positions-create-position-title" className="block text-sm font-medium text-neutral-700 mb-1.5">
            {t("hr.positions.positionTitle")} <span className="text-red-500">*</span>
          </label>
          <input id="hr-positions-create-position-title"
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={t("hr.positions.form.titlePlaceholder")}
            className={`form-input w-full ${errors.title ? "border-red-400" : ""}`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Grade + Headcount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hr-positions-create-grade" className="block text-sm font-medium text-neutral-700 mb-1.5">{t("hr.positions.grade")}</label>
            <select id="hr-positions-create-grade"
              value={form.grade}
              onChange={(e) => set("grade", e.target.value)}
              className="form-input w-full"
            >
              <option value="">{t("hr.positions.form.noGrade")}</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hr-positions-create-headcount" className="block text-sm font-medium text-neutral-700 mb-1.5">
              {t("hr.positions.headcount")} <span className="text-red-500">*</span>
            </label>
            <input id="hr-positions-create-headcount"
              type="number"
              min={1}
              max={999}
              value={form.headcount}
              onChange={(e) => set("headcount", e.target.value)}
              className={`form-input w-full ${errors.headcount ? "border-red-400" : ""}`}
            />
            {errors.headcount && <p className="text-xs text-red-500 mt-1">{errors.headcount}</p>}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="hr-positions-create-description" className="block text-sm font-medium text-neutral-700 mb-1.5">{t("hr.positions.form.description")}</label>
          <textarea id="hr-positions-create-description"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("hr.positions.form.descriptionPlaceholder")}
            className="form-input w-full resize-none"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            onClick={() => set("is_active", !form.is_active)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? "bg-primary" : "bg-neutral-300"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </button>
          <span className="text-sm text-neutral-700">{t("hr.positions.form.activePosition")}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
          <Link href="/hr/positions" className="btn-secondary">{t("common.cancel")}</Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? t("hr.positions.form.creating") : t("hr.positions.form.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
