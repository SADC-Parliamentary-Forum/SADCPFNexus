"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminApi, accessApi, type AccessPermissionDefinition, type Role } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Button } from "@/components/ui/Button";
import { isSystemAdmin, getStoredUser } from "@/lib/auth";

type Permission = AccessPermissionDefinition & { key: string };
const protectedRoles = new Set(["System Admin", "System Administrator", "super-admin", "admin", "Admin"]);

const label = (value: string) => value.replace(/[_.-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function PermissionMatrixPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = isSystemAdmin(getStoredUser());

  const load = async () => {
    setLoading(true);
    try {
      const [roleResponse, registryResponse] = await Promise.all([adminApi.listRoles(), accessApi.registry()]);
      setRoles(roleResponse.data.roles ?? []);
      setPermissions(Object.entries(registryResponse.data.data.permissions ?? {}).map(([key, value]) => ({ key, ...value })));
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? "Unable to load the permission registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const modules = useMemo(() => Array.from(new Set(permissions.map((permission) => permission.module))).sort(), [permissions]);
  const visiblePermissions = useMemo(() => permissions.filter((permission) => {
    const haystack = `${permission.key} ${permission.display_name} ${permission.feature} ${permission.action}`.toLowerCase();
    return (moduleFilter === "all" || permission.module === moduleFilter) && (!search || haystack.includes(search.toLowerCase()));
  }).sort((a, b) => `${a.module}.${a.feature}.${a.action}`.localeCompare(`${b.module}.${b.feature}.${b.action}`)), [permissions, moduleFilter, search]);

  const rolePermissionSet = (role: Role) => new Set((role.permissions ?? []).map((permission) => typeof permission === "string" ? permission : permission.name));

  const toggle = async (role: Role, permission: Permission) => {
    if (!canEdit || protectedRoles.has(role.name)) return;
    const current = rolePermissionSet(role);
    current.has(permission.key) ? current.delete(permission.key) : current.add(permission.key);
    setSaving(`${role.id}:${permission.key}`);
    setError(null);
    try {
      const response = await adminApi.syncRolePermissions(role.id, Array.from(current));
      setRoles((previous) => previous.map((item) => item.id === role.id ? { ...item, permissions: response.data.data.permissions } : item));
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? `Could not update ${permission.display_name} for ${role.name}.`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <ModulePageHeader
        title="Permission matrix"
        subtitle="Assign individual feature actions to roles. Rows are roles; columns are canonical permissions from the registry."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Access", href: "/admin/access" }, { label: "Roles", href: "/admin/access/roles" }, { label: "Matrix" }]} />}
        actions={<Link href="/admin/access/roles" className="btn-secondary text-sm">Feature builder</Link>}
      />

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input className="form-input min-w-72 flex-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search permission, feature, or action" aria-label="Search permissions" />
          <select className="form-input min-w-48" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} aria-label="Filter module"><option value="all">All modules</option>{modules.map((module) => <option key={module} value={module}>{label(module)}</option>)}</select>
          <span className="text-xs text-neutral-500">{visiblePermissions.length} permissions shown</span>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="p-10 text-center text-sm text-neutral-500">Loading permission registry...</div> : visiblePermissions.length === 0 ? <div className="p-10 text-center text-sm text-neutral-500">No permissions match the current filter.</div> : <div className="max-h-[70vh] overflow-auto"><table className="min-w-max border-collapse text-xs"><thead className="sticky top-0 z-20 bg-white"><tr><th className="sticky left-0 z-30 min-w-56 border-b border-r border-neutral-200 bg-white px-4 py-3 text-left">Role</th>{visiblePermissions.map((permission) => <th key={permission.key} className="w-32 border-b border-r border-neutral-200 px-2 py-3 text-center align-bottom" title={permission.key}><div className="font-semibold text-neutral-800">{label(permission.action)}</div><div className="mt-1 text-[10px] font-normal text-neutral-500">{label(permission.module)} / {label(permission.feature)}</div></th>)}</tr></thead><tbody>{roles.map((role) => { const selected = rolePermissionSet(role); const protectedRole = protectedRoles.has(role.name); return <tr key={role.id} className="hover:bg-neutral-50"><td className="sticky left-0 z-10 border-b border-r border-neutral-200 bg-white px-4 py-3"><div className="flex items-center gap-2"><span className="font-semibold text-neutral-900">{role.name}</span>{protectedRole ? <span className="material-symbols-outlined text-[15px] text-neutral-400" title="Protected role">lock</span> : null}</div><span className="text-[11px] text-neutral-500">{selected.size} assigned</span></td>{visiblePermissions.map((permission) => { const key = `${role.id}:${permission.key}`; return <td key={permission.key} className="border-b border-r border-neutral-100 px-2 py-3 text-center"><input type="checkbox" checked={selected.has(permission.key)} disabled={!canEdit || protectedRole || saving === key} onChange={() => void toggle(role, permission)} aria-label={`${role.name}: ${permission.display_name}`} title={`${selected.has(permission.key) ? "Revoke" : "Grant"} ${permission.key}`} className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary disabled:opacity-40" />{saving === key ? <span className="material-symbols-outlined ml-1 animate-spin align-middle text-[13px] text-primary">progress_activity</span> : null}</td>; })}</tr>; })}</tbody></table></div>}
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"><strong>Granular access:</strong> selecting <em>read</em> does not grant edit, delete, approve, or export. Use the feature builder for new roles and this matrix for precise role changes.</div>
      <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>Refresh registry</Button>
    </div>
  );
}
