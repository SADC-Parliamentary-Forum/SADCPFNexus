"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { peopleRowMatchesQuery } from "@/lib/peopleRowSearch";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { labelledObjectCell } from "@/components/ui/LabelledRecord";

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

export default function Page() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    principal_person_id: "",
    delegate_person_id: "",
    delegation_type: "workflow",
    start_at: today,
    end_at: today,
    reason: "",
    scope_action: "approve",
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority", "delegations"],
    queryFn: async () => (await peopleAuthorityApi.listDelegations()).data,
  });
  const peopleQuery = useQuery({
    queryKey: ["people-authority", "people-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPeople({ directory: 1, per_page: 100 })).data),
  });

  const rows = useMemo(() => asRows(data), [data]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => peopleRowMatchesQuery(r, q));
  }, [rows, q]);

  const create = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.createDelegation({
        principal_person_id: Number(form.principal_person_id),
        delegate_person_id: Number(form.delegate_person_id),
        delegation_type: form.delegation_type,
        start_at: form.start_at,
        end_at: form.end_at,
        reason: form.reason || undefined,
        scopes: [{ action: form.scope_action }],
      }),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "delegations"] });
    },
    onError: () => setErr("Could not create the delegation. Principal, delegate, dates, and a scope action are required."),
  });
  const approve = useMutation({
    mutationFn: (id: number) => peopleAuthorityApi.approveDelegation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people-authority", "delegations"] }),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => peopleAuthorityApi.revokeDelegation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people-authority", "delegations"] }),
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="Delegations"
        subtitle="People & Authority register"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Delegations" },
            ]}
          />
        }
        actions={
          <Link href="/people" className="btn-secondary text-sm">
            Hub
          </Link>
        }
      />

      <form
        className="card grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label htmlFor="people-delegations-principal-setform-f-required-select" className="block text-xs font-medium text-neutral-600">
          Principal
          <select id="people-delegations-principal-setform-f-required-select" className="form-input mt-1" value={form.principal_person_id} onChange={(e) => setForm((f) => ({ ...f, principal_person_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label htmlFor="people-delegations-delegate-setform-f-required-select" className="block text-xs font-medium text-neutral-600">
          Delegate
          <select id="people-delegations-delegate-setform-f-required-select" className="form-input mt-1" value={form.delegate_person_id} onChange={(e) => setForm((f) => ({ ...f, delegate_person_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label htmlFor="people-delegations-type-setform-f-workflow-approval-signing-prepara" className="block text-xs font-medium text-neutral-600">
          Type
          <select id="people-delegations-type-setform-f-workflow-approval-signing-prepara" className="form-input mt-1" value={form.delegation_type} onChange={(e) => setForm((f) => ({ ...f, delegation_type: e.target.value }))}>
            <option value="workflow">Workflow</option>
            <option value="approval">Approval</option>
            <option value="signing">Signing</option>
            <option value="preparation">Preparation</option>
            <option value="general">General</option>
          </select>
        </label>
        <label htmlFor="people-delegations-scope-action-setform-f-required" className="block text-xs font-medium text-neutral-600">
          Scope action
          <input id="people-delegations-scope-action-setform-f-required" className="form-input mt-1" value={form.scope_action} onChange={(e) => setForm((f) => ({ ...f, scope_action: e.target.value }))} required />
        </label>
        <label htmlFor="people-delegations-start-setform-f-required" className="block text-xs font-medium text-neutral-600">
          Start
          <input id="people-delegations-start-setform-f-required" type="date" className="form-input mt-1" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} required />
        </label>
        <label htmlFor="people-delegations-end-setform-f-required" className="block text-xs font-medium text-neutral-600">
          End
          <input id="people-delegations-end-setform-f-required" type="date" className="form-input mt-1" value={form.end_at} onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))} required />
        </label>
        <label htmlFor="people-delegations-reason-setform-f" className="block text-xs font-medium text-neutral-600 sm:col-span-2">
          Reason
          <input id="people-delegations-reason-setform-f" className="form-input mt-1" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create delegation"}
          </button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      <div className="card p-3">
        <label htmlFor="people-delegations-search-setq-e-target-value-placeholder-filter-ro" className="block text-xs font-medium text-neutral-600">
          Search
          <input id="people-delegations-search-setq-e-target-value-placeholder-filter-ro" className="form-input mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter rows…" />
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
            title="Unable to load"
            description="Could not retrieve this register."
            action={
              <button type="button" className="btn-primary text-sm" onClick={() => refetch()}>Retry</button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="inbox" title="No records" description="Nothing to show in this register yet." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Delegations</caption>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={String(r.id ?? idx)}>
                    <td>{labelledObjectCell(r.reference ?? r.id)}</td>
                    <td>{labelledObjectCell(r.delegation_type)}</td>
                    <td>{labelledObjectCell(r.status)}</td>
                    <td>{labelledObjectCell(r.start_at)}</td>
                    <td>{labelledObjectCell(r.end_at)}</td>
                    <td className="space-x-2">
                      {r.status !== "active" && r.status !== "revoked" && (
                        <button type="button" className="btn-secondary text-xs py-1 px-2 text-emerald-700" onClick={() => approve.mutate(Number(r.id))} disabled={approve.isPending}>
                          Approve
                        </button>
                      )}
                      {r.status !== "revoked" && (
                        <button type="button" className="btn-secondary text-xs py-1 px-2 text-red-600" onClick={() => revoke.mutate(Number(r.id))} disabled={revoke.isPending}>
                          Revoke
                        </button>
                      )}
                    </td>
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
