"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type LeaveRow = {
  id: number;
  reference_number: string;
  status: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  current_stage?: string;
  current_holder?: string;
  recommendation_status?: string;
  requester?: { id: number; name: string };
};

const TYPE_LABELS: Record<string, string> = {
  annual: "leave.type.annual",
  sick: "leave.type.sick",
  lil: "leave.type.lil",
  special: "leave.type.special",
  maternity: "leave.type.maternity",
  paternity: "leave.type.paternity",
};

export default function LeaveCertificationQueuePage() {
  const { success, error: showErrorToast, info } = useToast();
  const { t } = useI18n();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<{ data: LeaveRow[] }>("/leave/requests", {
        params: { queue: "certify", per_page: 50 },
      });
      const body = r.data as { data?: LeaveRow[] };
      setRows(Array.isArray(body.data) ? body.data : []);
    } catch {
      setRows([]);
      setError(t("leave.certifyQueue.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function certify(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/leave/requests/${id}/certify`, {
        action: "certify",
        comment: "Certified from queue",
      });
      success(t("leave.certifyQueue.toast.certified", { id }));
      await load();
    } catch {
      setError(t("leave.certifyQueue.certifyFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("leave.certifyQueue.title")}
        subtitle={t("leave.certifyQueue.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("nav.leave"), href: "/leave" }, { label: t("leave.certifyQueue.breadcrumb") }]} />
        }
        actions={
          <>
            <Link href="/leave" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">list</span>
              {t("leave.certifyQueue.register")}
            </Link>
            <Link href="/leave/toil" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              {t("leave.certifyQueue.toil")}
            </Link>
          </>
        }
      />
{error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => void load()}>
            {t("common.retry")}
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="fact_check"
            title={t("leave.certifyQueue.emptyTitle")}
            description={t("leave.certifyQueue.emptyDescription")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("leave.certifyQueue.col.reference")}</th>
                  <th>{t("leave.certificate.employee")}</th>
                  <th>{t("leave.detail.col.type")}</th>
                  <th>{t("leave.detail.col.dates")}</th>
                  <th>{t("leave.certifyQueue.col.stage")}</th>
                  <th>{t("leave.certifyQueue.col.holder")}</th>
                  <th><span className="sr-only">{t("leave.certifyQueue.col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/leave/${r.id}`} className="font-mono text-xs font-medium text-primary">
                        {r.reference_number}
                      </Link>
                    </td>
                    <td className="font-medium text-neutral-900">{r.requester?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-700">{TYPE_LABELS[r.leave_type] ? t(TYPE_LABELS[r.leave_type]) : r.leave_type}</td>
                    <td className="whitespace-nowrap text-xs text-neutral-600">
                      {formatDateShort(r.start_date)} → {formatDateShort(r.end_date)}
                    </td>
                    <td className="text-sm text-neutral-600">{r.current_stage ?? t("leave.detail.col.certification")}</td>
                    <td className="text-sm text-neutral-600">{r.current_holder ?? t("leave.certifyQueue.defaultHolder")}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/leave/${r.id}`} className="btn-secondary text-xs py-1 px-2">
                          {t("leave.certifyQueue.view")}
                        </Link>
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                          disabled={busyId === r.id}
                          onClick={() => void certify(r.id)}
                        >
                          {busyId === r.id ? t("leave.certifyQueue.certifying") : t("leave.detail.certify")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
