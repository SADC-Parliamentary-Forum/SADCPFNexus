"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { peopleRowMatchesQuery } from "@/lib/peopleRowSearch";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { EmptyState } from "@/components/ui/EmptyState";
import { labelledObjectCell } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function asRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (obj.data && typeof obj.data === "object") {
      const nested = obj.data as Record<string, unknown>;
      for (const key of ["data", "items", "results", "people", "units", "positions"]) {
        if (Array.isArray(nested[key])) return nested[key] as Record<string, unknown>[];
      }
    }
    for (const key of ["items", "results", "people", "units", "positions", "authorities", "delegations"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function personLabel(p: Record<string, unknown>): string {
  return String(p.preferred_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ") ?? p.name ?? p.id);
}

// Real module identifiers this app's authority checks are actually keyed against
// (AuthorityCheckService matches on these strings from each module's own workflow code).
const AUTHORITY_MODULES = [
  { value: "travel", label: "Travel", labelKey: "nav.travel" },
  { value: "leave", label: "Leave", labelKey: "nav.leave" },
  { value: "imprest", label: "Imprest", labelKey: "nav.imprest" },
  { value: "procurement", label: "Procurement", labelKey: "nav.procurement" },
  { value: "budget", label: "Finance / Budget", labelKey: "people.authority.modBudget" },
  { value: "correspondence", label: "Correspondence", labelKey: "people.authority.modCorrespondence" },
  { value: "risk", label: "Risk", labelKey: "people.authority.modRisk" },
  { value: "contracts", label: "Contracts", labelKey: "nav.contracts" },
  { value: "assets", label: "Assets", labelKey: "people.authority.modAssets" },
  { value: "hr", label: "HR", labelKey: "nav.hr" },
  { value: "governance", label: "Governance", labelKey: "people.authority.modGovernance" },
  { value: "supplier", label: "Supplier", labelKey: "people.authority.modSupplier" },
  { value: "stock", label: "Stock", labelKey: "people.authority.modStock" },
  { value: "salary_advance", label: "Salary Advances", labelKey: "nav.salary_advances" },
  { value: "workplan", label: "Workplan", labelKey: "nav.workplan" },
] as const;

// Action vocabulary already used across this app's approval workflows (recommend/certify/
// principal/authorise stages, plus signing flags on AuthorityDefinition).
const AUTHORITY_ACTIONS = [
  { value: "recommend", label: "Recommend", labelKey: "people.authority.actRecommend", isSigning: false },
  { value: "approve", label: "Approve", labelKey: "people.authority.actApprove", isSigning: false },
  { value: "certify", label: "Certify", labelKey: "people.authority.actCertify", isSigning: false },
  { value: "authorise", label: "Authorise", labelKey: "people.authority.actAuthorise", isSigning: false },
  { value: "sign", label: "Sign", labelKey: "people.authority.actSign", isSigning: true },
  { value: "prepare", label: "Prepare", labelKey: "people.authority.actPrepare", isSigning: false },
] as const;

export default function Page() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [createForm, setCreateForm] = useState({ module: "", action: "" });
  const [assignForm, setAssignForm] = useState({
    authority_definition_id: "",
    assignee_type: "Person",
    assignee_id: "",
    effective_from: today,
  });
  const peopleQuery = useQuery({
    queryKey: ["people-authority", "people-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPeople({ directory: 1, per_page: 100 })).data),
  });
  const positionsQuery = useQuery({
    queryKey: ["people-authority", "position-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPositions({ per_page: 100 })).data),
  });
  const assigneeOptions = assignForm.assignee_type === "Position" ? (positionsQuery.data ?? []) : (peopleQuery.data ?? []);
  const assigneeOptionsLoading = assignForm.assignee_type === "Position" ? positionsQuery.isLoading : peopleQuery.isLoading;
  const assigneeLabel = (r: Record<string, unknown>) =>
    assignForm.assignee_type === "Position" ? String(r.title ?? r.name ?? r.id) : personLabel(r);
  const create = useMutation({
    mutationFn: () => {
      const mod = AUTHORITY_MODULES.find((m) => m.value === createForm.module);
      const act = AUTHORITY_ACTIONS.find((a) => a.value === createForm.action);
      if (!mod || !act) throw new Error(t("people.authority.moduleActionRequired"));
      return peopleAuthorityApi.createAuthority({
        // Derived entirely from the two selections below — never free-typed.
        code: `${mod.value}_${act.value}`.toUpperCase(),
        name: `${act.label} ${mod.label}`,
        module: mod.value,
        is_signing: act.isSigning,
      });
    },
    onSuccess: () => {
      toast.success(t("people.authority.created"));
      setCreateForm({ module: "", action: "" });
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "authority-register"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.authority.createFailed"));
      setErr(message);
      toast.error(t("people.authority.notCreated"), message);
    },
  });
  const assign = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.assignAuthority({
        authority_definition_id: Number(assignForm.authority_definition_id),
        assignee_type: assignForm.assignee_type,
        assignee_id: Number(assignForm.assignee_id),
        effective_from: assignForm.effective_from,
      }),
    onSuccess: () => {
      toast.success(t("people.authority.assigned"));
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "authority-register"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.authority.assignFailed"));
      setErr(message);
      toast.error(t("people.authority.notAssigned"), message);
    },
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority", "authority-register"],
    queryFn: async () => {
return (await peopleAuthorityApi.listAuthorities()).data;
    },
  });

  const rows = useMemo(() => asRows(data), [data]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => peopleRowMatchesQuery(r, q));
  }, [rows, q]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const r of filtered.slice(0, 20)) {
      Object.keys(r).forEach((k) => {
        if (!["id", "uuid", "created_at", "updated_at", "deleted_at"].includes(k) && typeof r[k] !== "object") keys.add(k);
        else if (["name", "title", "status", "email", "code", "type"].includes(k)) keys.add(k);
      });
    }
    const preferred = ["name", "title", "code", "type", "status", "email", "first_name", "last_name"];
    const ordered = preferred.filter((k) => keys.has(k));
    for (const k of keys) if (!ordered.includes(k) && ordered.length < 6) ordered.push(k);
    return ordered.length ? ordered : ["id"];
  }, [filtered]);

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("people.authority.title")}
        subtitle={t("people.common.registerSubtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.authority.title") },
            ]}
          />
        }
        actions={
          <Link href="/people" className="btn-secondary text-sm">
            {t("people.common.hub")}
          </Link>
        }
      />

      <form
        className="card grid gap-3 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label htmlFor="people-authority-module-select" className="block text-xs font-medium text-neutral-600">
          {t("people.authority.module")}
          <select
            id="people-authority-module-select"
            className="form-input mt-1"
            value={createForm.module}
            onChange={(e) => setCreateForm((f) => ({ ...f, module: e.target.value }))}
            required
          >
            <option value="">{t("people.common.select")}</option>
            {AUTHORITY_MODULES.map((m) => (
              <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
            ))}
          </select>
        </label>
        <label htmlFor="people-authority-action-select" className="block text-xs font-medium text-neutral-600">
          {t("people.authority.action")}
          <select
            id="people-authority-action-select"
            className="form-input mt-1"
            value={createForm.action}
            onChange={(e) => setCreateForm((f) => ({ ...f, action: e.target.value }))}
            required
          >
            <option value="">{t("people.common.select")}</option>
            {AUTHORITY_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{t(a.labelKey)}</option>
            ))}
          </select>
        </label>
        <div className="block text-xs font-medium text-neutral-600">
          {t("people.authority.willCreate")}
          <p className="form-input mt-1 flex items-center bg-neutral-50 text-neutral-700">
            {createForm.module && createForm.action
              ? t("people.authority.willCreateName", {
                  action: t(AUTHORITY_ACTIONS.find((a) => a.value === createForm.action)?.labelKey ?? ""),
                  module: t(AUTHORITY_MODULES.find((m) => m.value === createForm.module)?.labelKey ?? ""),
                })
              : t("people.authority.selectModuleAction")}
          </p>
        </div>
        <div className="sm:col-span-3 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending || !createForm.module || !createForm.action}>
            {create.isPending ? t("people.common.saving") : t("people.authority.add")}
          </button>
        </div>
      </form>

      <form
        className="card grid gap-3 p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
      >
        <label htmlFor="people-authority-authority-setassignform-f-required-select" className="block text-xs font-medium text-neutral-600">
          {t("people.authority.authority")}
          <select id="people-authority-authority-setassignform-f-required-select" className="form-input mt-1" value={assignForm.authority_definition_id} onChange={(e) => setAssignForm((f) => ({ ...f, authority_definition_id: e.target.value }))} required>
            <option value="">{t("people.common.select")}</option>
            {filtered.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>{String(r.name ?? r.code ?? r.id)}</option>
            ))}
          </select>
        </label>
        <label htmlFor="people-authority-assignee-type-setassignform-f-person-position" className="block text-xs font-medium text-neutral-600">
          {t("people.authority.assigneeType")}
          <select
            id="people-authority-assignee-type-setassignform-f-person-position"
            className="form-input mt-1"
            value={assignForm.assignee_type}
            onChange={(e) => setAssignForm((f) => ({ ...f, assignee_type: e.target.value, assignee_id: "" }))}
          >
            <option value="Person">{t("people.common.person")}</option>
            <option value="Position">{t("people.common.position")}</option>
          </select>
        </label>
        <div>
          <label htmlFor="people-authority-assignee-setassignform-f-required-select" className="block text-xs font-medium text-neutral-600">
            {t("people.authority.assignee")}
            <select id="people-authority-assignee-setassignform-f-required-select" className="form-input mt-1" value={assignForm.assignee_id} onChange={(e) => setAssignForm((f) => ({ ...f, assignee_id: e.target.value }))} required>
              <option value="">{assigneeOptionsLoading ? t("common.loading") : t("people.common.select")}</option>
              {assigneeOptions.map((r) => (
                <option key={String(r.id)} value={String(r.id)}>{assigneeLabel(r)}</option>
              ))}
            </select>
          </label>
          {!assigneeOptionsLoading && assigneeOptions.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              {assignForm.assignee_type === "Position"
                ? t("people.authority.noPositions")
                : (
                  <>
                    {t("people.authority.noPeopleBefore")}{" "}
                    <Link href="/people/directory" className="font-semibold hover:opacity-80">{t("people.authority.staffDirectory")}</Link>
                    {t("people.authority.noPeopleAfter")}
                  </>
                )}
            </p>
          ) : null}
        </div>
        <label htmlFor="people-authority-effective-from-setassignform-f-required" className="block text-xs font-medium text-neutral-600">
          {t("people.authority.effectiveFrom")}
          <input id="people-authority-effective-from-setassignform-f-required" type="date" className="form-input mt-1" value={assignForm.effective_from} onChange={(e) => setAssignForm((f) => ({ ...f, effective_from: e.target.value }))} required />
        </label>
        <div className="sm:col-span-4 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={assign.isPending}>
            {assign.isPending ? t("people.common.saving") : t("people.authority.assign")}
          </button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      <div className="card p-3">
        <label htmlFor="people-authority-search-setq-e-target-value-placeholder-filter-ro" className="block text-xs font-medium text-neutral-600">
          {t("common.search")}
          <input id="people-authority-search-setq-e-target-value-placeholder-filter-ro"
            className="form-input mt-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("people.common.filterRows")}
          />
        </label>
      </div>

      {isLoading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="card">
          <EmptyState
            icon="error"
            title={t("people.common.unableToLoad")}
            description={t("people.common.loadFailed")}
            action={
              <button type="button" className="btn-primary text-sm" onClick={() => refetch()}>
                {t("common.retry")}
              </button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="inbox" title={t("people.common.noRecords")} description={t("people.common.emptyRegister")} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">{t("people.authority.title")}</caption>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="capitalize">
                      {c.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={String(r.id ?? idx)}>
                    {columns.map((c) => (
                      <td key={c}>{labelledObjectCell(r[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
