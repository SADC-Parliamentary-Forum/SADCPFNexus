"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { peopleRowMatchesQuery } from "@/lib/peopleRowSearch";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import type { ReactNode } from "react";
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

function cell(v: unknown): ReactNode {
  if (v == null) return "-";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const labelled = o.name ?? o.title ?? o.label ?? o.code;
    if (labelled != null && labelled !== "") return String(labelled);
    return <LabelledRecord value={v} nested />;
  }
  return String(v);
}

export default function Page() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const term = q;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority","search", q],
    queryFn: async () => {
return (await peopleAuthorityApi.search(q || "*")).data;
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
        title={t("people.search.title")}
        subtitle={t("people.search.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.search.title") },
            ]}
          />
        }
        actions={
          <Link href="/people" className="btn-secondary text-sm">
            {t("people.common.hub")}
          </Link>
        }
      />

      <div className="card p-3">
        <label htmlFor="people-search-search-setq-e-target-value-placeholder-filter-ro" className="block text-xs font-medium text-neutral-600">
          {t("common.search")}
          <input id="people-search-search-setq-e-target-value-placeholder-filter-ro"
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
              <caption className="sr-only">{t("people.search.title")}</caption>
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

