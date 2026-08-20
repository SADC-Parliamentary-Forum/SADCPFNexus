"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
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
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(term));
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
    <div className="mx-auto max-w-6xl space-y-5">
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
        <label className="block text-xs font-medium text-neutral-600">
          Principal
          <select className="form-input mt-1" value={form.principal_person_id} onChange={(e) => setForm((f) => ({ ...f, principal_person_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Delegate
          <select className="form-input mt-1" value={form.delegate_person_id} onChange={(e) => setForm((f) => ({ ...f, delegate_person_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Type
          <select className="form-input mt-1" value={form.delegation_type} onChange={(e) => setForm((f) => ({ ...f, delegation_type: e.target.value }))}>
            <option value="workflow">Workflow</option>
            <option value="approval">Approval</option>
            <option value="signing">Signing</option>
            <option value="preparation">Preparation</option>
            <option value="general">General</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Scope action
          <input className="form-input mt-1" value={form.scope_action} onChange={(e) => setForm((f) => ({ ...f, scope_action: e.target.value }))} required />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Start
          <input type="date" className="form-input mt-1" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} required />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          End
          <input type="date" className="form-input mt-1" value={form.end_at} onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))} required />
        </label>
        <label className="block text-xs font-medium text-neutral-600 sm:col-span-2">
          Reason
          <input className="form-input mt-1" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create delegation"}
          </button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      <div className="card p-3">
        <label className="block text-xs font-medium text-neutral-600">
          Search
          <input className="form-input mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter rows…" />
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
                        <button type="button" className="text-xs text-emerald-700 hover:underline" onClick={() => approve.mutate(Number(r.id))} disabled={approve.isPending}>
                          Approve
                        </button>
                      )}
                      {r.status !== "revoked" && (
                        <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => revoke.mutate(Number(r.id))} disabled={revoke.isPending}>
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
