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

export default function Page() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ code: "", name: "", category: "" });
  const [err, setErr] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ person_id: "", skill_id: "", level: "working" });
  const peopleQuery = useQuery({
    queryKey: ["people-authority", "people-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPeople({ directory: 1, per_page: 100 })).data),
  });
  const assign = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.assignSkill({
        person_id: Number(assignForm.person_id),
        skill_id: Number(assignForm.skill_id),
        level: assignForm.level,
      }),
    onSuccess: () => {
      toast.success(t("people.skills.assigned"));
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "skills"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.skills.assignFailed"));
      setErr(message);
      toast.error(t("people.skills.notAssigned"), message);
    },
  });
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

  const create = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.createSkill({
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("people.skills.created"));
      setForm({ code: "", name: "", category: "" });
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "skills"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.skills.createFailed"));
      setErr(message);
      toast.error(t("people.skills.notCreated"), message);
    },
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("people.skills.title")}
        subtitle={t("people.skills.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.skills.title") },
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
          if (!form.code.trim() || !form.name.trim()) {
            setErr(t("people.common.codeNameRequired"));
            return;
          }
          create.mutate();
        }}
      >
        <label htmlFor="people-skills-code-setform-f-required" className="block text-xs font-medium text-neutral-600">
          {t("people.common.code")}
          <input id="people-skills-code-setform-f-required" className="form-input mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
        </label>
        <label htmlFor="people-skills-name-setform-f-required" className="block text-xs font-medium text-neutral-600">
          {t("people.common.name")}
          <input id="people-skills-name-setform-f-required" className="form-input mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </label>
        <label htmlFor="people-skills-category-setform-f" className="block text-xs font-medium text-neutral-600">
          {t("people.common.category")}
          <input id="people-skills-category-setform-f" className="form-input mt-1" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
        </label>
        <div className="sm:col-span-3 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? t("people.common.saving") : t("people.skills.add")}
          </button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      <form
        className="card grid gap-3 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
      >
        <label htmlFor="people-skills-person-setassignform-f-required-select" className="block text-xs font-medium text-neutral-600">
          {t("people.common.person")}
          <select id="people-skills-person-setassignform-f-required-select" className="form-input mt-1" value={assignForm.person_id} onChange={(e) => setAssignForm((f) => ({ ...f, person_id: e.target.value }))} required>
            <option value="">{t("people.common.select")}</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label htmlFor="people-skills-skill-setassignform-f-required-select" className="block text-xs font-medium text-neutral-600">
          {t("people.skills.skill")}
          <select id="people-skills-skill-setassignform-f-required-select" className="form-input mt-1" value={assignForm.skill_id} onChange={(e) => setAssignForm((f) => ({ ...f, skill_id: e.target.value }))} required>
            <option value="">{t("people.common.select")}</option>
            {rows.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>{String(s.name ?? s.code ?? s.id)}</option>
            ))}
          </select>
        </label>
        <label htmlFor="people-skills-level-setassignform-f-awareness-working-proficie" className="block text-xs font-medium text-neutral-600">
          {t("people.skills.level")}
          <select id="people-skills-level-setassignform-f-awareness-working-proficie" className="form-input mt-1" value={assignForm.level} onChange={(e) => setAssignForm((f) => ({ ...f, level: e.target.value }))}>
            <option value="awareness">{t("people.skills.levelAwareness")}</option>
            <option value="working">{t("people.skills.levelWorking")}</option>
            <option value="proficient">{t("people.skills.levelProficient")}</option>
            <option value="expert">{t("people.skills.levelExpert")}</option>
          </select>
        </label>
        <div className="sm:col-span-3">
          <button type="submit" className="btn-primary text-sm" disabled={assign.isPending}>
            {assign.isPending ? t("people.common.saving") : t("people.skills.assign")}
          </button>
        </div>
      </form>

      <div className="card p-3">
        <label htmlFor="people-skills-search-setq-e-target-value-placeholder-filter-ro" className="block text-xs font-medium text-neutral-600">
          {t("common.search")}
          <input id="people-skills-search-setq-e-target-value-placeholder-filter-ro"
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
              <caption className="sr-only">{t("people.skills.title")}</caption>
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

