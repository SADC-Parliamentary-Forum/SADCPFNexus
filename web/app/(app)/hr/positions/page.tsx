"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { positionsApi, adminApi, type Position, type Department } from "@/lib/api";

const GRADES = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"];

export default function PositionsPage() {
  const qc = useQueryClient();
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const { data: deptsRes } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => adminApi.listDepartments(),
    staleTime: 60_000,
  });
  const departments: Department[] = (deptsRes?.data as any)?.data ?? deptsRes?.data ?? [];

  const { data: posRes, isLoading } = useQuery({
    queryKey: ["admin-positions", deptFilter, search],
    queryFn: () =>
      positionsApi.list({
        all: true,
        department_id: deptFilter || undefined,
        search: search || undefined,
      }).then((r) => r.data.data),
    staleTime: 30_000,
  });
  const positions: Position[] = posRes ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => positionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-positions"] });
      setDeleteTarget(null);
      setDeleteError("");
    },
    onError: (err: any) => {
      setDeleteError(err?.response?.data?.message ?? "Could not delete position.");
    },
  });

  // Group positions by department
  const grouped: Record<string, Position[]> = {};
  for (const pos of positions) {
    const deptName = pos.department?.name ?? "Unassigned";
    if (!grouped[deptName]) grouped[deptName] = [];
    grouped[deptName].push(pos);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href="/hr" className="hover:text-primary">HR</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">Positions</span>
          </div>
          <h1 className="page-title">Positions (Establishment)</h1>
          <p className="page-subtitle">Manage establishment positions across all departments.</p>
        </div>
        <Link href="/hr/positions/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Position
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search positions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 w-full"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : "")}
          className="form-input min-w-[200px]"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <span className="text-xs text-neutral-400 ml-auto">
          {positions.length} position{positions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Positions grouped by department */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 h-14 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
            <span className="material-symbols-outlined text-3xl text-neutral-300">work</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600">No positions found</p>
          <p className="text-xs text-neutral-400 mt-1">Create your first establishment position.</p>
          <Link href="/hr/positions/create" className="btn-primary mt-5 inline-flex">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Position
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([deptName, deptPositions]) => (
            <div key={deptName}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1 mb-2">
                {deptName} ({deptPositions.length})
              </h2>
              <div className="card overflow-hidden">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Position Title</th>
                      <th className="w-20 text-center">Grade</th>
                      <th className="w-24 text-center">Headcount</th>
                      <th className="w-24 text-center">Status</th>
                      <th className="w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptPositions.map((pos) => (
                      <tr key={pos.id}>
                        <td>
                          <div>
                            <p className="font-medium text-neutral-900">{pos.title}</p>
                            {pos.description && (
                              <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-xs">{pos.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-center">
                          {pos.grade ? (
                            <span className="inline-flex items-center justify-center w-10 h-7 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                              {pos.grade}
                            </span>
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-neutral-600">
                            <span className="material-symbols-outlined text-[14px] text-neutral-400">group</span>
                            {pos.headcount}
                          </div>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${pos.is_active ? "badge-success" : "badge-muted"}`}>
                            {pos.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/hr/positions/${pos.id}/edit`}
                              className="flex items-center justify-center h-7 w-7 rounded-lg text-neutral-400 hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </Link>
                            <button
                              onClick={() => { setDeleteTarget(pos); setDeleteError(""); }}
                              className="flex items-center justify-center h-7 w-7 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 mx-auto mb-4">
              <span className="material-symbols-outlined text-red-500 text-[24px]">warning</span>
            </div>
            <h3 className="text-base font-semibold text-neutral-900 text-center">Delete Position?</h3>
            <p className="text-sm text-neutral-500 text-center mt-1">
              <span className="font-medium text-neutral-700">{deleteTarget.title}</span> will be permanently removed.
            </p>
            {deleteError && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                className="btn-secondary flex-1"
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
