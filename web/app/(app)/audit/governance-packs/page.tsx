"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditTable } from "@/components/audit/AuditChrome";

type PlanProgress = {
  plan_id?: number;
  title?: string;
  status?: string;
  completion_pct?: number;
};

type PackFinding = {
  id?: number;
  title?: string;
  rating?: string;
  status?: string;
};

type GovernancePack = {
  id?: number;
  title?: string;
  fiscal_year?: number;
  audience?: string;
  payload?: {
    generated_at?: string;
    fiscal_year?: number;
    plan_progress?: PlanProgress[];
    critical_high_findings?: PackFinding[];
  };
};

export default function AuditGovernancePacksPage() {
  const { t } = useI18n();
  const [title, setTitle] = useState("FSC meeting pack");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [pack, setPack] = useState<GovernancePack | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      (await auditApi.createGovernancePack({
        title,
        fiscal_year: Number(year),
        audience: "fsc",
      })).data.data as GovernancePack,
    onSuccess: (row) => setPack(row),
  });

  const progress = pack?.payload?.plan_progress ?? [];
  const findings = pack?.payload?.critical_high_findings ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="audit.packs.title"
        subtitle="audit.packs.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "audit.hub", href: "/audit" }, { label: "audit.packs.title" }]} />}
      />
      <FormSection title="audit.packs.generate" icon="folder_special">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="audit-pack-title" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.packs.packTitle")}</label>
            <input id="audit-pack-title" className="form-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="audit-pack-year" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.packs.year")}</label>
            <input id="audit-pack-year" className="form-input w-full sm:w-40" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? t("audit.packs.generating") : t("audit.packs.generate")}
          </button>
        </div>
        {create.isError && <p className="mt-2 text-sm text-red-700">{t("audit.packs.error")}</p>}
      </FormSection>
      {pack && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {pack.title} · FY {pack.payload?.fiscal_year ?? pack.fiscal_year}
            {pack.payload?.generated_at ? ` · ${pack.payload.generated_at}` : ""}
          </p>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("audit.packs.planProgress")}</h2>
            {progress.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("audit.packs.noPlans")}</p>
            ) : (
              <AuditTable columns={["audit.col.plan", "audit.col.status", "audit.col.complete"]}>
                {progress.map((row) => (
                  <tr key={row.plan_id ?? row.title} className="border-b border-neutral-100">
                    <td className="px-3 py-2.5">{row.title ?? "—"}</td>
                    <td className="px-3 py-2.5 capitalize">{row.status ?? "—"}</td>
                    <td className="px-3 py-2.5">{row.completion_pct ?? 0}%</td>
                  </tr>
                ))}
              </AuditTable>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("audit.packs.findings")}</h2>
            {findings.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("audit.packs.noFindings")}</p>
            ) : (
              <AuditTable columns={["audit.col.finding", "audit.col.rating", "audit.col.status"]}>
                {findings.map((row) => (
                  <tr key={row.id ?? row.title} className="border-b border-neutral-100">
                    <td className="px-3 py-2.5">{row.title ?? "—"}</td>
                    <td className="px-3 py-2.5 capitalize">{row.rating ?? "—"}</td>
                    <td className="px-3 py-2.5 capitalize">{row.status ?? "—"}</td>
                  </tr>
                ))}
              </AuditTable>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
