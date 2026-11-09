"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type EvalRow = { id: number; reference_number: string; title: string; status: string };

const STATUS_KEYS: Record<string, string> = {
  draft: "myWork.evaluations.status.draft",
  open: "myWork.evaluations.status.open",
  in_progress: "myWork.evaluations.status.in_progress",
  completed: "myWork.evaluations.status.completed",
  closed: "myWork.evaluations.status.closed",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-muted",
  open: "badge-primary",
  in_progress: "badge-warning",
  completed: "badge-success",
  closed: "badge-muted",
};

export default function MyWorkProcurementEvaluationsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureOnly, setFeatureOnly] = useState(false);

  useEffect(() => {
    api
      .get<{ data: EvalRow[]; meta?: { feature_only?: boolean } }>("/procurement/committee-evaluations")
      .then((r) => r.data)
      .then((res) => {
        setRows(res.data ?? []);
        setFeatureOnly(Boolean(res.meta?.feature_only));
      })
      .catch((e) => setError(e?.message ?? t("myWork.evaluations.noAccess")))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("myWork.evaluations.title")}
        subtitle={
          featureOnly
            ? t("myWork.evaluations.subtitleFeatureOnly")
            : t("myWork.evaluations.subtitle")
        }
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("nav.my_work"), href: "/my-work" },
              { label: t("myWork.evaluations.title") },
            ]}
          />
        }
        actions={
          !featureOnly ? (
            <Link href="/procurement/evaluations" className="btn-secondary text-sm">
              {t("myWork.evaluations.fullRegister")}
            </Link>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {featureOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {t("myWork.evaluations.featureOnly")}
        </div>
      ) : null}

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="card">
          <EmptyState
            icon="gavel"
            title={t("myWork.evaluations.emptyTitle")}
            description={t("myWork.evaluations.emptyDescription")}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("leave.certifyQueue.col.reference")}</th>
                  <th>{t("assignments.handover.colTitle")}</th>
                  <th>{t("assignments.handover.colStatus")}</th>
                  <th><span className="sr-only">{t("leave.certifyQueue.col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-neutral-600">{r.reference_number}</td>
                    <td className="font-medium text-neutral-800">{r.title}</td>
                    <td>
                      <span className={`badge text-xs ${STATUS_BADGE[r.status] ?? "badge-muted"}`}>
                        {STATUS_KEYS[r.status] ? t(STATUS_KEYS[r.status]) : r.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/procurement/evaluations?highlight=${r.id}`}
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        {t("common.open")}
                      </Link>
                    </td>
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
