"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type User } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";

const classColors: Record<string, string> = {
  UNCLASSIFIED: "badge-muted",
  RESTRICTED:   "badge-warning",
  CONFIDENTIAL: "badge-warning",
  SECRET:       "badge-danger",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(isSystemAdmin(getStoredUser()));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: 15 };
    if (search) params.search = search;
    if (statusFilter !== "all") params.status = statusFilter;
    adminApi.listUsers(params)
      .then((res) => {
        setUsers((res.data as any).data ?? []);
        setTotal(res.data.total ?? 0);
      })
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const handleDeactivate = async (user: User) => {
    if (!user.is_active) return;
    setActionLoading(user.id);
    try {
      await adminApi.deactivateUser(user.id);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: false } : u));
    } catch {
      setError("Failed to deactivate user.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (user: User) => {
    if (user.is_active) return;
    setActionLoading(user.id);
    try {
      await adminApi.reactivateUser(user.id);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: true } : u));
    } catch {
      setError("Failed to reactivate user.");
    } finally {
      setActionLoading(null);
    }
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const lastPage = Math.ceil(total / 15) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage system access, roles, and security compliance for all personnel.</p>
        </div>
        {isAdmin && (
          <Link href="/admin/users/create" className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add User
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Users",   value: total,                                       icon: "people",        color: "text-primary",   bg: "bg-primary/10" },
          { label: "Active",        value: activeCount,                                  icon: "check_circle",  color: "text-green-600", bg: "bg-green-50"   },
          { label: "Inactive",      value: total - activeCount,                          icon: "block",         color: "text-red-500",   bg: "bg-red-50"     },
          { label: "MFA Enabled",   value: users.filter((u) => u.mfa_enabled).length,   icon: "security",      color: "text-purple-600",bg: "bg-purple-50"  },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{s.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-0.5">{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setStatusFilter(f); setPage(1); }}
                className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 text-[18px]">search</span>
            <input
              className="form-input pl-9"
              placeholder="Search users…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="flex items-center justify-center gap-2 text-neutral-400">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              <span className="text-sm">Loading…</span>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="hidden md:table-cell">Department</th>
                    <th className="hidden lg:table-cell">Classification</th>
                    <th>Status</th>
                    <th className="hidden sm:table-cell">MFA</th>
                    {isAdmin && <th className="text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 text-sm">{user.name}</p>
                            <p className="text-xs text-neutral-400">{user.email}{user.employee_number ? ` · ${user.employee_number}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <p className="text-sm text-neutral-700">{user.department?.name ?? "—"}</p>
                        <p className="text-xs text-neutral-400">{user.job_title ?? ""}</p>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className={`badge ${classColors[user.classification] ?? "badge-muted"}`}>
                          {user.classification}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${user.is_active ? "badge-success" : "badge-muted"}`}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${user.mfa_enabled ? "text-green-600" : "text-neutral-400"}`}>
                          <span className="material-symbols-outlined text-[14px]">{user.mfa_enabled ? "verified_user" : "security"}</span>
                          {user.mfa_enabled ? "Enabled" : "Off"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex items-center justify-end gap-3">
                            <Link href={`/admin/users/${user.id}`} className="text-xs font-semibold text-primary hover:underline">Edit</Link>
                            {user.is_active ? (
                              <button
                                onClick={() => handleDeactivate(user)}
                                disabled={actionLoading === user.id}
                                className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "…" : "Deactivate"}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(user)}
                                disabled={actionLoading === user.id}
                                className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "…" : "Reactivate"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-neutral-200">person_search</span>
                <p className="mt-3 text-sm font-medium text-neutral-500">No users found</p>
                <p className="text-xs text-neutral-400">Try adjusting your search or filters.</p>
              </div>
            )}

            {/* Pagination */}
            <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-neutral-400">{users.length} of {total} users</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1.5 text-xs text-neutral-600 font-medium">Page {page} of {lastPage}</span>
                <button
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
