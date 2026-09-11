"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { positionsApi, adminApi, type Department } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

const GRADES = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"];

export default function CreatePositionPage() {
  const router = useRouter();
  const qc = useQueryClient();

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
      router.push("/hr/positions");
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data?.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.errors)) {
          mapped[k] = Array.isArray(v) ? (v as string[])[0] : String(v);
        }
        setErrors(mapped);
      } else {
        setErrors({ _global: data?.message ?? "Failed to create position." });
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
    if (!form.department_id) errs.department_id = "Department is required.";
    if (!form.title.trim()) errs.title = "Title is required.";
    if (Number(form.headcount) < 1) errs.headcount = "Headcount must be at least 1.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    mutation.mutate();
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="New Position"
        subtitle="Add an establishment position to a department."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "Positions", href: "/hr/positions" },
              { label: "New Position" },
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
            Department <span className="text-red-500">*</span>
          </label>
          <select id="hr-positions-create-department"
            value={form.department_id}
            onChange={(e) => set("department_id", e.target.value)}
            className={`form-input w-full ${errors.department_id ? "border-red-400" : ""}`}
          >
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {errors.department_id && <p className="text-xs text-red-500 mt-1">{errors.department_id}</p>}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="hr-positions-create-position-title" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Position Title <span className="text-red-500">*</span>
          </label>
          <input id="hr-positions-create-position-title"
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Senior Programme Officer"
            className={`form-input w-full ${errors.title ? "border-red-400" : ""}`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Grade + Headcount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hr-positions-create-grade" className="block text-sm font-medium text-neutral-700 mb-1.5">Grade</label>
            <select id="hr-positions-create-grade"
              value={form.grade}
              onChange={(e) => set("grade", e.target.value)}
              className="form-input w-full"
            >
              <option value="">No grade</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hr-positions-create-headcount" className="block text-sm font-medium text-neutral-700 mb-1.5">
              Headcount <span className="text-red-500">*</span>
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
          <label htmlFor="hr-positions-create-description" className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
          <textarea id="hr-positions-create-description"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Brief description of the position's responsibilities…"
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
          <span className="text-sm text-neutral-700">Active position</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
          <Link href="/hr/positions" className="btn-secondary">Cancel</Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? "Creating…" : "Create Position"}
          </button>
        </div>
      </form>
    </div>
  );
}
