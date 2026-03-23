"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { positionsApi, adminApi, type Department, type Position } from "@/lib/api";

const GRADES = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"];

export default function EditPositionPage() {
  const { id } = useParams<{ id: string }>();
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
  const [loaded, setLoaded] = useState(false);

  const { data: posRes, isLoading } = useQuery({
    queryKey: ["admin-position", id],
    queryFn: () => positionsApi.get(Number(id)).then((r) => r.data.data),
    staleTime: 30_000,
  });

  const { data: deptsRes } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => adminApi.listDepartments(),
    staleTime: 60_000,
  });
  const departments: Department[] = (deptsRes?.data as any)?.data ?? deptsRes?.data ?? [];

  useEffect(() => {
    if (posRes && !loaded) {
      setForm({
        department_id: String(posRes.department_id),
        title: posRes.title,
        grade: posRes.grade ?? "",
        description: posRes.description ?? "",
        headcount: String(posRes.headcount),
        is_active: posRes.is_active,
      });
      setLoaded(true);
    }
  }, [posRes, loaded]);

  const mutation = useMutation({
    mutationFn: () =>
      positionsApi.update(Number(id), {
        department_id: Number(form.department_id),
        title: form.title.trim(),
        grade: form.grade || null,
        description: form.description.trim() || null,
        headcount: Number(form.headcount),
        is_active: form.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-positions"] });
      qc.invalidateQueries({ queryKey: ["admin-position", id] });
      router.push("/admin/positions");
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
        setErrors({ _global: data?.message ?? "Failed to update position." });
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

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 w-48 bg-neutral-100 animate-pulse rounded-lg" />
        <div className="card p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-neutral-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/admin" className="hover:text-primary">Admin</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/admin/positions" className="hover:text-primary">Positions</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700 font-medium">Edit Position</span>
        </div>
        <h1 className="page-title">Edit Position</h1>
        <p className="page-subtitle text-neutral-500 text-sm">
          {posRes?.title ?? "Loading…"} · {posRes?.department?.name ?? ""}
        </p>
      </div>

      {errors._global && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
          {errors._global}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Department <span className="text-red-500">*</span>
          </label>
          <select
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
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Position Title <span className="text-red-500">*</span>
          </label>
          <input
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
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Grade</label>
            <select
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
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Headcount <span className="text-red-500">*</span>
            </label>
            <input
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
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Brief description of the position's responsibilities…"
            className="form-input w-full resize-none"
          />
        </div>

        {/* Assigned users (read-only info) */}
        {posRes?.users && posRes.users.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Assigned Users</label>
            <div className="flex flex-wrap gap-2">
              {posRes.users.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-medium">
                  <span className="material-symbols-outlined text-[13px]">person</span>
                  {u.name}
                </span>
              ))}
            </div>
          </div>
        )}

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
          <Link href="/admin/positions" className="btn-secondary">Cancel</Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
