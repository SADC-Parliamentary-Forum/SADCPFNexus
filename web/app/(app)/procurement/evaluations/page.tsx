"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function EvaluationsPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["procurement", "evaluations"],
    queryFn: () => tendersApi.evaluations().then((r) => r.data.data),
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("procurement.evaluations.title")}
        subtitle={t("procurement.evaluations.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("nav.procurement"), href: "/procurement" },
              { label: t("procurement.evaluations.title") },
            ]}
          />
        }
        actions={
          <Link href="/my-work/procurement-evaluations" className="btn-secondary text-sm">
            {t("procurement.evaluations.myAssigned")}
          </Link>
        }
      />

      {isError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{t("procurement.evaluations.loadError")}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => void refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState icon="gavel" title={t("procurement.evaluations.empty")} description={t("procurement.evaluations.emptyHint")} />
        </div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((tender) => (
            <Link key={tender.id} href={`/procurement/tenders/${tender.id}`} className="card block space-y-2 p-4 hover:bg-neutral-50">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{tender.reference_number} — {tender.title}</p>
                  <p className="text-xs text-neutral-500">
                    {t("procurement.evaluations.meta", {
                      opened: tender.bids_opened_at ?? "—",
                      tech: tender.technical_weight ?? 80,
                      fin: tender.financial_weight ?? 20,
                      min: tender.min_technical_score ?? 70,
                    })}
                  </p>
                </div>
                <span className="badge badge-muted text-xs uppercase">{tender.status}</span>
              </div>
              {(tender.scoring?.length ?? 0) > 0 && (
                <div className="space-y-1 text-xs text-neutral-600">
                  {(tender.scoring ?? []).slice(0, 3).map((s) => (
                    <p key={s.quote_id}>
                      {s.financials_sealed
                        ? t("procurement.evaluations.scoreSealed", { vendor: s.vendor_name, tech: s.technical_score ?? "—" })
                        : t("procurement.evaluations.score", {
                            vendor: s.vendor_name,
                            tech: s.technical_score ?? "—",
                            fin: s.financial_score ?? "—",
                            combined: s.combined_score ?? "—",
                          })}
                    </p>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
