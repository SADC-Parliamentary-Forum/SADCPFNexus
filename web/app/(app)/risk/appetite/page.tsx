"use client";

import { useEffect, useState } from "react";
import { riskApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function RiskAppetitePage() {
  const { t } = useI18n();
  const [policies, setPolicies] = useState<Array<{ id: number; title: string; version?: number; tolerance_statement?: string; is_active?: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    riskApi.listAppetitePolicies()
      .then((r) => setPolicies((r.data as { data?: typeof policies }).data ?? []))
      .catch((e: { response?: { data?: { message?: string } } }) => setError(e?.response?.data?.message ?? t("risk.appetite.loadError")));
  }, [t]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <ModulePageHeader
        title="risk.appetite.title"
        subtitle="risk.appetite.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "risk.hub", href: "/risk" }, { label: "risk.appetite.title" }]} />}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        {policies.map((p) => (
          <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">{p.title} <span className="text-xs text-neutral-500">v{p.version}</span></div>
                <div className="text-xs text-neutral-500 mt-1">{p.tolerance_statement}</div>
              </div>
              {p.is_active && <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">{t("risk.appetite.active")}</span>}
            </div>
          </div>
        ))}
        {policies.length === 0 && !error && (
          <p className="text-sm text-neutral-500">{t("risk.appetite.empty")}</p>
        )}
      </div>
    </div>
  );
}
