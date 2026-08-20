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
  const [form, setForm] = useState({
    position_id: "",
    person_id: "",
    assignment_type: "substantive",
    start_at: today,
  });
  const positionsQuery = useQuery({
    queryKey: ["people-authority", "positions-options"],
    queryFn: async () => {
      const res = await peopleAuthorityApi.listPositions();
      return asRows(res.data);
    },
  });
  const peopleQuery = useQuery({
    queryKey: ["people-authority", "people-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPeople({ directory: 1, per_page: 100 })).data),
  });
  const assign = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.assignPosition(Number(form.position_id), {
        person_id: Number(form.person_id),
        assignment_type: form.assignment_type,
        start_at: form.start_at,
      }),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "position-assignments"] });
    },
    onError: () => setErr("Could not assign the position. Person, position, type, and start date are required."),
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority", "position-assignments"],
    queryFn: async () => {
      const chart = (await peopleAuthorityApi.orgChart()).data.data as Record<string, unknown>;
      return chart.assignments ?? [];
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
        title="Position Assignments"
        subtitle="People & Authority register"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Position Assignments" },
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
        className="card grid gap-3 p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
      >
        <label className="block text-xs font-medium text-neutral-600">
          Position
          <select className="form-input mt-1" value={form.position_id} onChange={(e) => setForm((f) => ({ ...f, position_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(positionsQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{String(p.title ?? p.code ?? p.id)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Person
          <select className="form-input mt-1" value={form.person_id} onChange={(e) => setForm((f) => ({ ...f, person_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Assignment type
          <select className="form-input mt-1" value={form.assignment_type} onChange={(e) => setForm((f) => ({ ...f, assignment_type: e.target.value }))}>
            <option value="substantive">Substantive</option>
            <option value="acting">Acting</option>
            <option value="temporary">Temporary</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Start
          <input type="date" className="form-input mt-1" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} required />
        </label>
        <div className="sm:col-span-4 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={assign.isPending}>
            {assign.isPending ? "Saving…" : "Assign position"}
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
              <caption className="sr-only">Position Assignments</caption>
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
