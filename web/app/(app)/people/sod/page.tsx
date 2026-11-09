"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { peopleRowMatchesQuery } from "@/lib/peopleRowSearch";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
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

export default function Page() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const analyse = useMutation({
    mutationFn: () => peopleAuthorityApi.analyseSod({ title: title.trim() || undefined }),
    onSuccess: () => {
      setTitle("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "sod"] });
    },
    onError: () => setErr(t("people.sod.runFailed")),
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority","sod"],
    queryFn: async () => {
return (await peopleAuthorityApi.listSodReports()).data;
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
        title={t("people.sod.title")}
        subtitle={t("people.sod.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.sod.title") },
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
        className="card grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          analyse.mutate();
        }}
      >
        <label htmlFor="people-sod-report-title-settitle-e-target-value-placeholder" className="block text-xs font-medium text-neutral-600">
          {t("people.sod.reportTitle")}
          <input id="people-sod-report-title-settitle-e-target-value-placeholder" className="form-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("people.common.optional")} />
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={analyse.isPending}>
            {analyse.isPending ? t("people.sod.analysing") : t("people.sod.run")}
          </button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      <div className="card p-3">
        <label htmlFor="people-sod-search-setq-e-target-value-placeholder-filter-ro" className="block text-xs font-medium text-neutral-600">
          {t("common.search")}
          <input id="people-sod-search-setq-e-target-value-placeholder-filter-ro"
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
              <caption className="sr-only">{t("people.sod.title")}</caption>
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

