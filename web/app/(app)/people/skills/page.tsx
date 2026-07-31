"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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

export default function Page() {
  const [q, setQ] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority","skills"],
    queryFn: async () => {
return (await peopleAuthorityApi.listSkills()).data;
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
        title="Skills"
        subtitle="People & Skills"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Skills" },
            ]}
          />
        }
        actions={
          <Link href="/people" className="btn-secondary text-sm">
            Hub
          </Link>
        }
      />

      <div className="card p-3">
        <label className="block text-xs font-medium text-neutral-600">
          Search
          <input
            className="form-input mt-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter rowsâ€¦"
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
              <caption className="sr-only">Skills</caption>
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

