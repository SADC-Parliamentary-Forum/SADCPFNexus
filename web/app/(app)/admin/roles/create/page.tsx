"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi } from "@/lib/api";

const MODULE_GROUPS = [
  { label: "Travel",       icon: "flight",               color: "blue",   perms: ["travel.view","travel.create","travel.approve","travel.admin"] },
  { label: "Leave",        icon: "event_available",      color: "emerald",perms: ["leave.view","leave.create","leave.approve","leave.admin"] },
  { label: "Imprest",      icon: "payments",             color: "amber",  perms: ["imprest.view","imprest.create","imprest.approve","imprest.liquidate"] },
  { label: "Finance",      icon: "account_balance",      color: "violet", perms: ["finance.view","finance.create","finance.approve","finance.export","finance.admin"] },
  { label: "Procurement",  icon: "shopping_cart",        color: "orange", perms: ["procurement.view","procurement.create","procurement.approve","procurement.award","procurement.manage_vendors","procurement.manage_po","procurement.receive_goods","procurement.approve_invoice","procurement.hod_approve","procurement.manage_budget","procurement.admin"] },
  { label: "Assets",       icon: "inventory_2",          color: "teal",   perms: ["assets.view","assets.create","assets.edit","assets.dispose","assets.admin","assets.manage"] },
  { label: "Governance",   icon: "gavel",                color: "purple", perms: ["governance.view","governance.create","governance.approve","governance.admin"] },
  { label: "HR",           icon: "people",               color: "pink",   perms: ["hr.view","hr.create","hr.edit","hr.approve","hr.admin"] },
  { label: "Timesheets",   icon: "schedule",             color: "rose",   perms: ["timesheets.view","timesheets.create","timesheets.approve"] },
  { label: "Appraisals",   icon: "star_rate",            color: "yellow", perms: ["appraisals.view","appraisals.create","appraisals.review","appraisals.admin"] },
  { label: "Conduct",      icon: "policy",               color: "red",    perms: ["conduct.view","conduct.create","conduct.admin"] },
  { label: "PIF",          icon: "folder_special",       color: "lime",   perms: ["pif.view","pif.create","pif.approve","pif.admin"] },
  { label: "Workplan",     icon: "calendar_month",       color: "sky",    perms: ["workplan.view","workplan.create","workplan.approve","workplan.admin"] },
  { label: "Assignments",  icon: "task_alt",             color: "stone",  perms: ["assignments.view","assignments.create","assignments.issue","assignments.admin"] },
  { label: "Calendar",     icon: "event",                color: "fuchsia",perms: ["calendar.view","calendar.create","calendar.admin"] },
  { label: "Support",      icon: "support_agent",        color: "zinc",   perms: ["support.view","support.create","support.admin"] },
  { label: "Users",        icon: "manage_accounts",      color: "indigo", perms: ["users.view","users.create","users.edit","users.deactivate","users.delete"] },
  { label: "Roles",        icon: "admin_panel_settings", color: "slate",  perms: ["roles.view","roles.manage","system.admin"] },
  { label: "Reports",      icon: "bar_chart",            color: "cyan",   perms: ["reports.view","reports.export","reports.audit","audit.view","audit.export"] },
];

const GROUP_COLORS: Record<string, { header: string; iconBg: string; iconText: string; selectAll: string }> = {
  blue:    { header: "bg-blue-50 border-blue-100",       iconBg: "bg-blue-100",    iconText: "text-blue-600",    selectAll: "text-blue-600" },
  emerald: { header: "bg-emerald-50 border-emerald-100", iconBg: "bg-emerald-100", iconText: "text-emerald-600", selectAll: "text-emerald-600" },
  amber:   { header: "bg-amber-50 border-amber-100",     iconBg: "bg-amber-100",   iconText: "text-amber-600",   selectAll: "text-amber-600" },
  violet:  { header: "bg-violet-50 border-violet-100",   iconBg: "bg-violet-100",  iconText: "text-violet-600",  selectAll: "text-violet-600" },
  orange:  { header: "bg-orange-50 border-orange-100",   iconBg: "bg-orange-100",  iconText: "text-orange-600",  selectAll: "text-orange-600" },
  teal:    { header: "bg-teal-50 border-teal-100",       iconBg: "bg-teal-100",    iconText: "text-teal-600",    selectAll: "text-teal-600" },
  purple:  { header: "bg-purple-50 border-purple-100",   iconBg: "bg-purple-100",  iconText: "text-purple-600",  selectAll: "text-purple-600" },
  pink:    { header: "bg-pink-50 border-pink-100",       iconBg: "bg-pink-100",    iconText: "text-pink-600",    selectAll: "text-pink-600" },
  rose:    { header: "bg-rose-50 border-rose-100",       iconBg: "bg-rose-100",    iconText: "text-rose-600",    selectAll: "text-rose-600" },
  yellow:  { header: "bg-yellow-50 border-yellow-100",   iconBg: "bg-yellow-100",  iconText: "text-yellow-600",  selectAll: "text-yellow-600" },
  red:     { header: "bg-red-50 border-red-100",         iconBg: "bg-red-100",     iconText: "text-red-600",     selectAll: "text-red-600" },
  lime:    { header: "bg-lime-50 border-lime-100",       iconBg: "bg-lime-100",    iconText: "text-lime-600",    selectAll: "text-lime-600" },
  sky:     { header: "bg-sky-50 border-sky-100",         iconBg: "bg-sky-100",     iconText: "text-sky-600",     selectAll: "text-sky-600" },
  stone:   { header: "bg-stone-50 border-stone-100",     iconBg: "bg-stone-100",   iconText: "text-stone-600",   selectAll: "text-stone-600" },
  fuchsia: { header: "bg-fuchsia-50 border-fuchsia-100", iconBg: "bg-fuchsia-100", iconText: "text-fuchsia-600", selectAll: "text-fuchsia-600" },
  zinc:    { header: "bg-zinc-50 border-zinc-100",       iconBg: "bg-zinc-100",    iconText: "text-zinc-600",    selectAll: "text-zinc-600" },
  indigo:  { header: "bg-indigo-50 border-indigo-100",   iconBg: "bg-indigo-100",  iconText: "text-indigo-600",  selectAll: "text-indigo-600" },
  slate:   { header: "bg-slate-50 border-slate-100",     iconBg: "bg-slate-100",   iconText: "text-slate-600",   selectAll: "text-slate-600" },
  cyan:    { header: "bg-cyan-50 border-cyan-100",       iconBg: "bg-cyan-100",    iconText: "text-cyan-600",    selectAll: "text-cyan-600" },
};

function permLabel(perm: string): string {
  const part = perm.split(".")[1] ?? perm;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export default function AdminRolesCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [availablePerms, setAvailablePerms] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listRoles()
      .then((res) => {
        const perms: { id: number; name: string }[] = res.data.permissions ?? [];
        setAvailablePerms(new Set(perms.map((p) => p.name)));
      })
      .catch(() => setError("Failed to load permissions."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (permName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permName)) next.delete(permName);
      else next.add(permName);
      return next;
    });
  };

  const toggleGroup = (groupPerms: string[]) => {
    const allSelected = groupPerms.every((p) => selected.has(p));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) groupPerms.forEach((p) => next.delete(p));
      else groupPerms.forEach((p) => next.add(p));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError("Role name is required."); return; }
    setSubmitting(true);
    try {
      await adminApi.createRole({ name: trimmed, permissions: Array.from(selected) });
      router.push("/admin/roles");
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      setError(
        ax.response?.data?.message ??
        (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0]) ??
        "Failed to create role."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const groupsWithSelection = MODULE_GROUPS.filter((g) => g.perms.some((p) => selected.has(p))).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <span className="material-symbols-outlined animate-spin text-[24px] mr-2">progress_activity</span>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/admin/roles" className="hover:text-primary transition-colors">Roles</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">New role</span>
      </div>

      <h1 className="text-xl font-bold text-neutral-900">Create Role</h1>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Role name */}
        <div className="card p-5">
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Role name <span className="text-red-500">*</span>
          </label>
          <input
            className="form-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Parliamentary Business Officer"
            required
          />
        </div>

        {/* Module permission sections */}
        {MODULE_GROUPS.map((group) => {
          const colors = GROUP_COLORS[group.color] ?? GROUP_COLORS.slate;
          const groupPerms = group.perms.filter((p) => availablePerms.has(p));
          const selectedCount = groupPerms.filter((p) => selected.has(p)).length;
          const allSelected = groupPerms.length > 0 && selectedCount === groupPerms.length;

          return (
            <div key={group.label} className="card overflow-hidden">
              <div className={`flex items-center justify-between px-5 py-3 border-b ${colors.header}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${colors.iconBg}`}>
                    <span className={`material-symbols-outlined text-[16px] ${colors.iconText}`}>{group.icon}</span>
                  </span>
                  <span className="text-sm font-semibold text-neutral-800">{group.label}</span>
                  <span className="text-xs text-neutral-500">{selectedCount}/{groupPerms.length} selected</span>
                </div>
                {groupPerms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupPerms)}
                    className={`text-xs font-medium hover:underline ${colors.selectAll}`}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                )}
              </div>
              <div className="p-5">
                {groupPerms.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">No permissions defined for this module yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {groupPerms.map((perm) => (
                      <label key={perm} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selected.has(perm)}
                          onChange={() => toggle(perm)}
                          className="rounded border-neutral-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-neutral-700 group-hover:text-neutral-900">
                          {permLabel(perm)}
                        </span>
                        <span className="text-xs text-neutral-400">{perm}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Summary + submit */}
        <div className="card p-5">
          <p className="text-sm text-neutral-600 mb-4">
            <span className="font-semibold text-neutral-900">{selected.size}</span> permission{selected.size !== 1 ? "s" : ""} selected
            {groupsWithSelection > 0 && (
              <> across <span className="font-semibold text-neutral-900">{groupsWithSelection}</span> module{groupsWithSelection !== 1 ? "s" : ""}</>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
              {submitting ? "Creating…" : "Create role"}
            </button>
            <Link href="/admin/roles" className="btn-secondary px-5 py-2.5 text-sm">Cancel</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
