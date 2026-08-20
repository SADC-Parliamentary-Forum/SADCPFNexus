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
  const [enrolForm, setEnrolForm] = useState({ person_id: "", enrolment_type: "drawn" });
  const [activateId, setActivateId] = useState("");
  const peopleQuery = useQuery({
    queryKey: ["people-authority", "people-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPeople({ directory: 1, per_page: 100 })).data),
  });
  const enrol = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.enrolSignature({
        person_id: Number(enrolForm.person_id),
        enrolment_type: enrolForm.enrolment_type,
      }),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "signature-register"] });
    },
    onError: () => setErr("Could not enrol the signature. Staff specimen capture is on SAAM."),
  });
  const activate = useMutation({
    mutationFn: () => peopleAuthorityApi.activateSignature(Number(activateId)),
    onSuccess: () => {
      setActivateId("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "signature-register"] });
    },
    onError: () => setErr("Could not activate that enrolment."),
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority", "signature-register"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPeople({ directory: 1, per_page: 100 })).data),
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
        title="Signature Register"
        subtitle="People & Authority register"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Signature Register" },
            ]}
          />
        }
        actions={
          <Link href="/saam" className="btn-secondary text-sm">
            SAAM enrolment
          </Link>
        }
      />

      <p className="text-sm text-neutral-600">
        Staff capture their specimen in <Link href="/saam" className="text-primary underline">SAAM</Link>. This register enrols and activates records for administration.
      </p>

      <form
        className="card grid gap-3 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          enrol.mutate();
        }}
      >
        <label className="block text-xs font-medium text-neutral-600">
          Person
          <select className="form-input mt-1" value={enrolForm.person_id} onChange={(e) => setEnrolForm((f) => ({ ...f, person_id: e.target.value }))} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Enrolment type
          <input className="form-input mt-1" value={enrolForm.enrolment_type} onChange={(e) => setEnrolForm((f) => ({ ...f, enrolment_type: e.target.value }))} />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary text-sm" disabled={enrol.isPending}>
            {enrol.isPending ? "Saving…" : "Enrol signature"}
          </button>
        </div>
      </form>

      <form
        className="card flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          activate.mutate();
        }}
      >
        <label className="block text-xs font-medium text-neutral-600">
          Enrolment id
          <input className="form-input mt-1" value={activateId} onChange={(e) => setActivateId(e.target.value)} required />
        </label>
        <button type="submit" className="btn-primary text-sm" disabled={activate.isPending}>
          {activate.isPending ? "Activating…" : "Activate signature"}
        </button>
        {err && <p className="text-sm text-red-700">{err}</p>}
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
              <caption className="sr-only">Signature Register</caption>
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
