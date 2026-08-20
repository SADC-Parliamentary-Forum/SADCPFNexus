"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

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

function cell(v: unknown): string {
  if (v == null) return "-";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.name ?? o.title ?? o.label ?? o.code ?? JSON.stringify(v));
  }
  return String(v);
}

function personLabel(p: Record<string, unknown>): string {
  return String(p.preferred_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ") ?? p.name ?? p.id);
}

export default function Page() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [createForm, setCreateForm] = useState({ code: "", name: "", module: "" });
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
  const create = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.createAuthority({
        code: createForm.code.trim(),
        name: createForm.name.trim(),
        module: createForm.module.trim() || undefined,
      }),
    onSuccess: () => {
      setCreateForm({ code: "", name: "", module: "" });
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "authority-register"] });
    },
    onError: () => setErr("Could not create the authority. Code and name are required."),
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
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "authority-register"] });
    },
    onError: () => setErr("Could not assign authority. Definition, assignee, and start date are required."),
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
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(term));
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
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Authority Register"
        subtitle="People & Authority register"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Authority Register" },
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
        className="card grid gap-3 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label className="block text-xs font-medium text-neutral-600">
          Code
          <input className="form-input mt-1" value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} required />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Name
          <input className="form-input mt-1" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Module
          <input className="form-input mt-1" value={createForm.module} onChange={(e) => setCreateForm((f) => ({ ...f, module: e.target.value }))} />
        </label>
        <div className="sm:col-span-3 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Add authority"}
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
        <label className="block text-xs font-medium text-neutral-600">
          Authority
          <select className="form-input mt-1" value={assignForm.authority_definition_id} onChange={(e) => setAssignForm((f) => ({ ...f, authority_definition_id: e.target.value }))} required>
            <option value="">Select…</option>
            {filtered.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>{String(r.name ?? r.code ?? r.id)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Assignee type
          <select className="form-input mt-1" value={assignForm.assignee_type} onChange={(e) => setAssignForm((f) => ({ ...f, assignee_type: e.target.value }))}>
            <option value="Person">Person</option>
            <option value="Position">Position</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Assignee
          <select className="form-input mt-1" value={assignForm.assignee_id} onChange={(e) => setAssignForm((f) => ({ ...f, assignee_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Effective from
          <input type="date" className="form-input mt-1" value={assignForm.effective_from} onChange={(e) => setAssignForm((f) => ({ ...f, effective_from: e.target.value }))} required />
        </label>
        <div className="sm:col-span-4 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={assign.isPending}>
            {assign.isPending ? "Saving…" : "Assign authority"}
          </button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      <div className="card p-3">
        <label className="block text-xs font-medium text-neutral-600">
          Search
          <input
            className="form-input mt-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter rows…"
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
            title="Unable to load"
            description="Could not retrieve this register."
            action={
              <button type="button" className="btn-primary text-sm" onClick={() => refetch()}>
                Retry
              </button>
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
              <caption className="sr-only">Authority Register</caption>
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
                      <td key={c}>{cell(r[c])}</td>
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
