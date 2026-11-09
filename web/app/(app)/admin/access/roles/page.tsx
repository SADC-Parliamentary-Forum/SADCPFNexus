"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api, { type AccessPermissionDefinition } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  extractRolePermissions,
  scrollRoleBuilderIntoView,
  suggestedCopyName,
} from "@/lib/access-role-starting-point";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Role = {
  id: number;
  name: string;
  purpose?: string;
  risk_level?: string;
  status?: string;
  feature_only?: boolean;
  read_only?: boolean;
  no_business_approve?: boolean;
  current_version?: { version: number; permissions: string[] } | null;
  latest_version?: { version: number; status: string; permissions: string[] } | null;
};

type PermissionRow = AccessPermissionDefinition & { key: string };

const protectedNames = new Set(["System Admin", "System Administrator", "super-admin", "admin", "Admin"]);

function title(value: string): string {
  return value.replace(/[_.-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function riskVariant(risk?: string): "muted" | "warning" | "danger" {
  if (risk === "critical") return "danger";
  if (risk === "high") return "warning";
  return "muted";
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string[] | string> } } })?.response?.data;
  const fromErrors = data?.errors
    ? Object.values(data.errors).flat().filter(Boolean).join(" ")
    : "";
  if (fromErrors) return fromErrors;
  if (data?.message) return data.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function AccessRolesPage() {
  const { t } = useI18n();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [risk, setRisk] = useState("medium");
  const [readOnly, setReadOnly] = useState(false);
  const [noBusinessApprove, setNoBusinessApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rolesResponse, registryResponse] = await Promise.all([
        api.get<{ data: Role[] }>("/admin/access/roles"),
        api.get<{ data: { permissions: Record<string, AccessPermissionDefinition> } }>("/admin/access/registry"),
      ]);
      setRoles(rolesResponse.data.data ?? []);
      const rows = Object.entries(registryResponse.data.data.permissions ?? {})
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => `${a.module}.${a.feature}.${a.action}`.localeCompare(`${b.module}.${b.feature}.${b.action}`));
      setPermissions(rows);
      setExpandedModules(new Set(rows.map((row) => row.module)));
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? error?.message ?? t("admin.access.roles.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const modules = useMemo(
    () => Array.from(new Set(permissions.map((permission) => permission.module))).sort(),
    [permissions],
  );

  const filteredPermissions = useMemo(() => permissions.filter((permission) => {
    const haystack = `${permission.key} ${permission.display_name} ${permission.description ?? ""} ${permission.feature} ${permission.action}`.toLowerCase();
    return (moduleFilter === "all" || permission.module === moduleFilter) && (!search || haystack.includes(search.toLowerCase()));
  }), [permissions, moduleFilter, search]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const permission of filteredPermissions) {
      groups.set(permission.module, [...(groups.get(permission.module) ?? []), permission]);
    }
    return Array.from(groups.entries());
  }, [filteredPermissions]);

  const togglePermission = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectModule = (module: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      permissions.filter((permission) => permission.module === module).forEach((permission) => {
        checked ? next.add(permission.key) : next.delete(permission.key);
      });
      return next;
    });
  };

  const startFromRole = (role: Role) => {
    const rolePermissions = extractRolePermissions(role);
    if (rolePermissions.length === 0) {
      setMessage(t("admin.access.roles.noPermsToCopy", { role: role.name }));
      scrollRoleBuilderIntoView();
      return;
    }
    setSelected(new Set(rolePermissions));
    setName((current) => suggestedCopyName(current, role.name));
    setPurpose(role.purpose ?? "");
    setRisk(role.risk_level ?? "medium");
    setReadOnly(Boolean(role.read_only));
    setNoBusinessApprove(Boolean(role.no_business_approve));
    setExpandedModules(new Set(
      permissions.filter((permission) => rolePermissions.includes(permission.key)).map((permission) => permission.module),
    ));
    setMessage(t(rolePermissions.length === 1 ? "admin.access.roles.copiedOne" : "admin.access.roles.copiedMany", { role: role.name, count: rolePermissions.length }));
    scrollRoleBuilderIntoView();
  };

  const createDraft = async () => {
    if (!name.trim() || selected.size === 0) {
      setMessage(t("admin.access.roles.nameAndPermRequired"));
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.post("/admin/access/roles", {
        name: name.trim(),
        purpose,
        risk_level: risk,
        read_only: readOnly,
        no_business_approve: noBusinessApprove,
        permissions: Array.from(selected),
        changelog: "Created from feature permission builder",
      });
      setName("");
      setPurpose("");
      setSelected(new Set());
      setMessage(t("admin.access.roles.draftCreated"));
      await load();
    } catch (error: unknown) {
      setMessage(apiErrorMessage(error, t("admin.access.roles.createFailed")));
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async (role: Role) => {
    const draft = role.latest_version;
    if (!draft || draft.status !== "draft") return;
    setSaving(true);
    setMessage(null);
    try {
      await api.post(`/admin/access/roles/${role.id}/publish`, {
        permissions: draft.permissions,
        changelog: "Published from the governed role catalogue",
      });
      setMessage(t("admin.access.roles.published", { role: role.name }));
      await load();
    } catch (error: unknown) {
      setMessage(apiErrorMessage(error, t("admin.access.roles.publishFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("admin.access.roles.title")}
        subtitle={t("admin.access.roles.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.homeLabel"), href: "/admin" }, { label: t("admin.crumb.access"), href: "/admin/access" }, { label: t("admin.crumb.roles") }]} />}
        actions={<Link href="/admin/access/roles/matrix" className="btn-secondary text-sm">{t("admin.access.roles.openMatrix")}</Link>}
      />

      <div id="role-draft">
      <FormSection title={t("admin.access.roles.createSection")} description={t("admin.access.roles.createSectionDesc")} icon="badge">
        <div className="grid gap-3 md:grid-cols-4">
          <FormField label={t("admin.access.roles.roleName")} htmlFor="role-name" required className="md:col-span-1">
            <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("admin.access.roles.roleNamePlaceholder")} />
          </FormField>
          <FormField label={t("admin.access.roles.purpose")} htmlFor="role-purpose" className="md:col-span-2">
            <Input id="role-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder={t("admin.access.roles.purposePlaceholder")} />
          </FormField>
          <FormField label={t("admin.access.roles.riskLevel")} htmlFor="role-risk">
            <select id="role-risk" value={risk} onChange={(event) => setRisk(event.target.value)} className="form-input">
              <option value="low">{t("admin.common.low")}</option><option value="medium">{t("admin.common.medium")}</option><option value="high">{t("admin.common.high")}</option><option value="critical">{t("admin.common.critical")}</option>
            </select>
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-700">
          <label htmlFor="admin-access-roles-setreadonly-event-target-checked-read-only-role" className="inline-flex items-center gap-2"><input id="admin-access-roles-setreadonly-event-target-checked-read-only-role" type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} /> {t("admin.access.roles.readOnlyRole")}</label>
          <label htmlFor="admin-access-roles-setnobusinessapprove-event-target-checked-no-bus" className="inline-flex items-center gap-2"><input id="admin-access-roles-setnobusinessapprove-event-target-checked-no-bus" type="checkbox" checked={noBusinessApprove} onChange={(event) => setNoBusinessApprove(event.target.checked)} /> {t("admin.access.roles.noBusinessApprovals")}</label>
          <span className="text-neutral-500">{t(selected.size === 1 ? "admin.access.roles.selectedOne" : "admin.access.roles.selectedMany", { count: selected.size })}</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={createDraft} disabled={saving}>{saving ? t("admin.access.roles.creating") : t("admin.access.roles.createDraft")}</Button>
          {message ? <p className="text-sm text-neutral-600" role="status">{message}</p> : null}
        </div>
      </FormSection>
      </div>

      <div id="role-builder" className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-900">{t("admin.access.roles.builderTitle")}</h2>
            <p className="text-xs text-neutral-500">{t("admin.access.roles.builderDesc")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input aria-label={t("admin.access.matrix.searchLabel")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.access.roles.searchPlaceholder")} />
            <select aria-label={t("admin.access.roles.filterByModule")} value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="form-input min-w-44">
              <option value="all">{t("admin.access.matrix.allModules")}</option>{modules.map((module) => <option key={module} value={module}>{title(module)}</option>)}
            </select>
          </div>
        </div>
        {loading ? <div className="mt-4 h-32 animate-pulse rounded bg-neutral-100" /> : groupedPermissions.length === 0 ? <div className="mt-4"><EmptyState icon="search_off" title={t("admin.access.roles.noMatch")} description={t("admin.access.roles.noMatchDesc")} /></div> : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {groupedPermissions.map(([module, rows]) => {
              const moduleSelected = rows.filter((row) => selected.has(row.key)).length;
              const open = expandedModules.has(module);
              return <section key={module} className="overflow-hidden rounded-xl border border-neutral-200">
                <div className="flex items-center justify-between bg-neutral-50 px-4 py-3">
                  <button type="button" onClick={() => setExpandedModules((current) => { const next = new Set(current); next.has(module) ? next.delete(module) : next.add(module); return next; })} className="flex items-center gap-2 text-left">
                    <span className="material-symbols-outlined text-[18px]">{open ? "expand_more" : "chevron_right"}</span><span className="font-semibold text-neutral-900">{title(module)}</span><span className="text-xs text-neutral-500">{moduleSelected}/{rows.length}</span>
                  </button>
                  <label htmlFor={`admin-access-roles-select-module-${module}`} className="text-xs font-medium text-primary"><input id={`admin-access-roles-select-module-${module}`} type="checkbox" checked={moduleSelected === rows.length} onChange={(event) => selectModule(module, event.target.checked)} /> <span className="ml-1">{t("admin.access.roles.selectModule")}</span></label>
                </div>
                {open ? <div className="divide-y divide-neutral-100">{rows.map((permission) => <label htmlFor={`admin-access-roles-toggle-${permission.key}`} key={permission.key} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-neutral-50"><input id={`admin-access-roles-toggle-${permission.key}`} type="checkbox" checked={selected.has(permission.key)} onChange={() => togglePermission(permission.key)} className="mt-1" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900"><span>{permission.display_name || title(permission.feature)}</span><Badge variant={riskVariant(permission.risk_level)}>{permission.action}</Badge>{permission.mfa_required ? <Badge variant="muted">{"MFA"}</Badge> : null}</span><span className="mt-0.5 block text-xs text-neutral-500">{permission.description || permission.key}</span><span className="mt-1 block text-[11px] text-neutral-400">{t("admin.access.roles.featureScope", { feature: title(permission.feature), scope: (permission.supported_scopes ?? []).join(", ") || t("admin.access.roles.definedByPolicy") })}</span></span></label>)}</div> : null}
              </section>;
            })}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 px-4 py-3"><h2 className="font-semibold text-neutral-900">{t("admin.access.roles.governedTitle")}</h2><p className="text-xs text-neutral-500">{t("admin.access.roles.governedDesc")}</p></div>
        {roles.length === 0 ? <EmptyState icon="badge" title={t("admin.access.roles.empty")} description={t("admin.access.roles.emptyDesc")} /> : <div className="divide-y divide-neutral-100">{roles.map((role) => <div key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><div className="flex items-center gap-2"><span className="font-medium text-neutral-900">{role.name}</span>{protectedNames.has(role.name) ? <Badge variant="danger">{t("admin.access.roles.badgeProtected")}</Badge> : null}{role.read_only ? <Badge variant="muted">{t("admin.access.roles.badgeReadOnly")}</Badge> : null}{role.latest_version?.status === "draft" ? <Badge variant="warning">{t("admin.access.roles.badgeDraft")}</Badge> : null}</div><p className="text-xs text-neutral-500">{role.purpose || t("admin.access.roles.noPurpose")} · {t("admin.access.roles.permCount", { count: role.latest_version?.permissions?.length ?? role.current_version?.permissions?.length ?? 0 })} · v{role.latest_version?.version ?? role.current_version?.version ?? "-"}</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => startFromRole(role)}>{t("admin.access.roles.useAsStart")}</Button>{role.latest_version?.status === "draft" ? <Button type="button" size="sm" onClick={() => publishDraft(role)} disabled={saving}>{t("admin.access.roles.publish")}</Button> : null}</div></div>)}</div>}
      </div>
    </div>
  );
}
