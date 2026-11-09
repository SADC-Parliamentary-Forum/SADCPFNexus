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

export default function Page() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ position_id: "", title: "" });
  const [err, setErr] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority","succession"],
    queryFn: async () => {
return (await peopleAuthorityApi.listSuccession()).data;
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

  const positionsQuery = useQuery({
    queryKey: ["people-authority", "position-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPositions({ per_page: 100 })).data),
  });

  const create = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.createSuccession({
        position_id: Number(form.position_id),
        title: form.title.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("people.succession.created"));
      setForm({ position_id: "", title: "" });
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "succession"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.succession.createFailed"));
      setErr(message);
      toast.error(t("people.succession.notCreated"), message);
    },
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("people.succession.title")}
        subtitle={t("people.succession.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.succession.title") },
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
          if (!form.position_id) {
            setErr(t("people.succession.selectPosition"));
            return;
          }
          create.mutate();
        }}
      >
        <label htmlFor="people-succession-position-setform-f-required-select" className="block text-xs font-medium text-neutral-600">
          {t("people.common.position")}
          <select id="people-succession-position-setform-f-required-select" className="form-input mt-1" value={form.position_id} onChange={(e) => setForm((f) => ({ ...f, position_id: e.target.value }))} required>
            <option value="">{t("people.common.select")}</option>
            {(positionsQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.title ?? p.name ?? p.code ?? p.id)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="people-succession-plan-title-setform-f" className="block text-xs font-medium text-neutral-600">
          {t("people.succession.planTitle")}
          <input id="people-succession-plan-title-setform-f" className="form-input mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? t("people.common.saving") : t("people.succession.create")}
          </button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      <div className="card p-3">
        <label htmlFor="people-succession-search-setq-e-target-value-placeholder-filter-ro" className="block text-xs font-medium text-neutral-600">
          {t("common.search")}
          <input id="people-succession-search-setq-e-target-value-placeholder-filter-ro"
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
              <caption className="sr-only">{t("people.succession.title")}</caption>
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

