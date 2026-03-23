"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api, { workAssignmentsApi, WorkAssignment, User } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

type StatsData = { total: number; by_status: Record<string, number>; overdue: number; my_assignments: number };

const PRIORITY_FILTERS = ["All", "Critical", "High", "Medium", "Low"] as const;
const STATUS_TABS = [
  { label: "My Work", value: "mine" },
  { label: "Assigned By Me", value: "by_me" },
  { label: "All", value: "all" },
  { label: "Overdue", value: "overdue" },
] as const;

function priorityBadge(priority: WorkAssignment["priority"]) {
  const map: Record<string, string> = {
    critical: "badge-danger",
    high: "badge-warning",
    medium: "badge-primary",
    low: "badge-muted",
  };
  return map[priority] ?? "badge-muted";
}

function statusBadge(status: WorkAssignment["status"]) {
  const map: Record<string, string> = {
    draft: "badge-muted",
    assigned: "badge-primary",
    in_progress: "badge-primary",
    pending_review: "badge-warning",
    completed: "badge-success",
    overdue: "badge-danger",
    cancelled: "badge-muted",
  };
  return map[status] ?? "badge-muted";
}

function statusLabel(status: WorkAssignment["status"]) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssignmentsPage() {
  const router = useRouter();
  const currentUser = getStoredUser();

  const [tab, setTab] = useState<"mine" | "by_me" | "all" | "overdue">("mine");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // New assignment modal
  const [showModal, setShowModal] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    title: "",
    assigned_to: "",
    description: "",
    priority: "medium",
    due_date: "",
    estimated_hours: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await workAssignmentsApi.stats();
      setStats(res.data);
    } catch {
      // non-critical
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = { per_page: 25, page };
      if (tab === "mine" && currentUser?.id) params.assigned_to = currentUser.id;
      if (tab === "by_me" && currentUser?.id) params.assigned_by = currentUser.id;
      if (tab === "overdue") params.overdue = true;
      if (priorityFilter !== "All") params.priority = priorityFilter.toLowerCase();

      const res = await workAssignmentsApi.list(params as Parameters<typeof workAssignmentsApi.list>[0]);
      setAssignments(res.data.data);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    } catch {
      setError("Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, [tab, priorityFilter, page, currentUser?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
  }, [tab, priorityFilter]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const openModal = async () => {
    setShowModal(true);
    if (tenantUsers.length === 0) {
      try {
        const res = await api.get<{ data: User[] }>("/tenant-users");
        setTenantUsers(res.data.data ?? (res.data as unknown as User[]));
      } catch {
        // ignore
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.assigned_to) {
      setFormError("Title and assignee are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await workAssignmentsApi.create({
        title: form.title,
        assigned_to: Number(form.assigned_to),
        description: form.description || undefined,
        priority: form.priority,
        due_date: form.due_date || undefined,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
      });
      setShowModal(false);
      setForm({ title: "", assigned_to: "", description: "", priority: "medium", due_date: "", estimated_hours: "" });
      loadAssignments();
      loadStats();
    } catch {
      setFormError("Failed to create assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const statCards = [
    { label: "My Assignments", value: stats?.my_assignments ?? "—", icon: "task_alt", color: "text-blue-600 bg-blue-50" },
    { label: "In Progress", value: stats?.by_status?.in_progress ?? "—", icon: "pending", color: "text-amber-600 bg-amber-50" },
    { label: "Overdue", value: stats?.overdue ?? "—", icon: "schedule", color: "text-red-600 bg-red-50" },
    { label: "Completed", value: stats?.by_status?.completed ?? "—", icon: "check_circle", color: "text-green-600 bg-green-50" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Work Assignments</h1>
          <p className="page-subtitle">Track and manage work tasks and assignments</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openModal}>
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Assignment
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2 flex-shrink-0 ${s.color}`}>
              <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">{s.value}</p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
          {/* Tab filters */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`filter-tab${tab === t.value ? " active" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Priority pills */}
          <div className="flex gap-1 flex-wrap">
            {PRIORITY_FILTERS.map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  priorityFilter === p
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-primary hover:text-primary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">
            <span className="material-symbols-outlined text-[40px] block mb-2">error_outline</span>
            {error}
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <span className="material-symbols-outlined text-[48px] block mb-2">task_alt</span>
            <p className="font-medium">No assignments found</p>
            <p className="text-sm mt-1">Try changing your filters or create a new assignment.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assignee</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Hours (Est / Act)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr
                      key={a.id}
                      className={`cursor-pointer hover:bg-neutral-50 ${a.is_overdue ? "border-l-4 border-l-red-400" : ""}`}
                      onClick={() => router.push(`/hr/assignments/${a.id}`)}
                    >
                      <td className="font-medium text-neutral-800">{a.title}</td>
                      <td className="text-neutral-600">{a.assigned_to_user?.name ?? `#${a.assigned_to}`}</td>
                      <td>
                        <span className={`badge ${priorityBadge(a.priority)}`}>
                          {a.priority.charAt(0).toUpperCase() + a.priority.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadge(a.status)}`}>{statusLabel(a.status)}</span>
                      </td>
                      <td className={a.is_overdue ? "text-red-600 font-medium" : "text-neutral-600"}>
                        {a.due_date ? (
                          <span className="flex items-center gap-1">
                            {a.is_overdue && (
                              <span className="material-symbols-outlined text-[14px] text-red-500">warning</span>
                            )}
                            {formatDateShort(a.due_date)}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="text-neutral-600">
                        {a.estimated_hours ?? "—"} / {a.actual_hours}h
                      </td>
                      <td>
                        <button
                          className="text-primary hover:underline text-sm font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/hr/assignments/${a.id}`);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {lastPage > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-neutral-500">
                <span>{total} total</span>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span className="px-2 py-1">
                    {page} / {lastPage}
                  </span>
                  <button
                    className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h2 className="font-semibold text-neutral-800 text-lg">New Assignment</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Assignment title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Assign To *</label>
                <select
                  className="form-input"
                  value={form.assigned_to}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                >
                  <option value="">Select staff member...</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the assignment..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
                  <select
                    className="form-input"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Est. Hours</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.estimated_hours}
                    onChange={(e) => setForm((f) => ({ ...f, estimated_hours: e.target.value }))}
                    placeholder="e.g. 8"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Due Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
