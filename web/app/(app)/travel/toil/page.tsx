"use client";

import { useCallback, useEffect, useState } from "react";
import { travelApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type ToilRow = {
  id: number;
  candidate_date: string;
  hours: number;
  reason: string | null;
  status: string;
  expires_at?: string | null;
  sg_extend_reason?: string | null;
  travel_request?: { id: number; reference_number: string };
  user?: { id: number; name: string };
};

const STATUS_LABEL: Record<string, string> = {
  pending_supervisor: "Pending supervisor",
  pending_hr: "Pending HR",
  credited: "Credited",
  rejected: "Rejected",
  expired: "Expired",
  extended: "Extended (SG)",
  candidate: "Pending supervisor",
  ot_authorised: "Pending supervisor",
  duty_confirmed: "Pending HR",
  lapsed: "Expired",
};

export default function TravelToilPage() {
  const { t } = useI18n();
  const { prompt } = useConfirm();
  const { success, error } = useToast();
  const [rows, setRows] = useState<ToilRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    travelApi.listToil({ per_page: 50 })
      .then((r) => setRows((r.data.data as ToilRow[]) ?? []))
      .catch((err: unknown) => error(apiErrorMessage(err, t("travel.toil.loadError"))))
      .finally(() => setLoading(false));
  }, [error, t]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      success(t(ok));
      load();
    } catch (err: unknown) {
      error(apiErrorMessage(err, t("travel.toil.actionFailed")));
    }
  };

  const extend = async (id: number) => {
    const reason = (await prompt({
      title: "travel.toil.extendTitle",
      label: "travel.toil.extendReason",
      required: true,
    }))?.trim();
    if (!reason) {
      error(t("travel.toil.extendCancelled"));
      return;
    }
    const expires = await prompt({
      title: "travel.toil.extendTitle",
      message: "travel.toil.extendExpiryHint",
      label: "travel.toil.extendExpiry",
      inputType: "date",
    });
    await act(
      () => travelApi.toilExtend(id, {
        reason,
        ...(expires?.trim() ? { expires_at: expires.trim() } : {}),
      }),
      "travel.toil.extendOk",
    );
  };

  const reject = async (id: number) => {
    const reason = (await prompt({
      title: "travel.toil.rejectTitle",
      label: "travel.toil.rejectReason",
      required: true,
      variant: "danger",
    }))?.trim();
    if (!reason) return;
    await act(() => travelApi.toilReject(id, reason), "travel.toil.rejected");
  };

  const awaitsSupervisor = (s: string) =>
    s === "pending_supervisor" || s === "candidate" || s === "ot_authorised";
  const awaitsHr = (s: string) => s === "pending_hr" || s === "duty_confirmed";

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="travel.toil.title"
        subtitle="travel.toil.subtitle"
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "nav.travel", href: "/travel" }, { label: "travel.toil.title" }]} />
        }
      />
      {loading ? (
        <p className="text-sm text-neutral-400">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="event_busy" title="travel.toil.empty" description="travel.toil.emptyHint" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Traveller</th>
                <th>Travel</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.candidate_date}</td>
                  <td>{r.user?.name ?? "—"}</td>
                  <td className="font-mono text-sm">{r.travel_request?.reference_number ?? "—"}</td>
                  <td>{r.hours}</td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td>{r.expires_at ?? "—"}</td>
                  <td className="space-x-2 text-xs">
                    {awaitsSupervisor(r.status) && (
                      <button
                        type="button"
                        className="btn-secondary py-1 px-2"
                        onClick={() => act(() => travelApi.toilConfirmDuty(r.id), "travel.toil.dutyConfirmed")}
                      >
                        {t("travel.toil.confirmDuty")}
                      </button>
                    )}
                    {awaitsHr(r.status) && (
                      <button
                        type="button"
                        className="btn-primary py-1 px-2"
                        onClick={() => act(() => travelApi.toilHrValidate(r.id), "travel.toil.credited")}
                      >
                        {t("travel.toil.hrValidate")}
                      </button>
                    )}
                    {(r.status === "credited" || r.status === "extended" || r.status === "expired") && (
                      <button
                        type="button"
                        className="btn-secondary py-1 px-2"
                        onClick={() => extend(r.id)}
                      >
                        {t("travel.toil.sgExtend")}
                      </button>
                    )}
                    {awaitsSupervisor(r.status) || awaitsHr(r.status) ? (
                      <button
                        type="button"
                        className="btn-secondary py-1 px-2 text-red-700"
                        onClick={() => reject(r.id)}
                      >
                        {t("common.reject")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
