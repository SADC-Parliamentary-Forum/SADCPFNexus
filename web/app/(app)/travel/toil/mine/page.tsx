"use client";

import { useCallback, useEffect, useState } from "react";
import { travelApi, type TravelToilMineRow } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Confirmation = "worked" | "travelled" | "did_not_work";

const REASON_LABEL: Record<string, string> = {
  weekend: "Weekend",
  public_holiday: "Public holiday",
  both: "Weekend + public holiday",
};

export default function MyToilConfirmationPage() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const [rows, setRows] = useState<TravelToilMineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Record<number, Confirmation | undefined>>({});
  const [comment, setComment] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    travelApi.listMyToil()
      .then((r) => setRows(r.data ?? []))
      .catch((err: unknown) => error(apiErrorMessage(err, t("travel.toil.mine.loadError"))))
      .finally(() => setLoading(false));
  }, [error, t]);

  useEffect(() => { load(); }, [load]);

  const confirmOne = async (id: number, confirmation: Confirmation) => {
    setBusyId(id);
    try {
      await travelApi.toilConfirm(id, { confirmation, comment: comment[id]?.trim() || undefined });
      success(t("travel.toil.mine.confirmed"));
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      error(apiErrorMessage(err, t("travel.toil.mine.actionFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const confirmAllWorked = async () => {
    for (const row of rows) {
      await confirmOne(row.id, "worked");
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="travel.toil.mine.title"
        subtitle="travel.toil.mine.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.travel", href: "/travel" },
              { label: "travel.toil.title", href: "/travel/toil" },
              { label: "travel.toil.mine.title" },
            ]}
          />
        }
        actions={
          rows.length > 1 ? (
            <button type="button" className="btn-secondary text-sm" onClick={() => void confirmAllWorked()}>
              {t("travel.toil.mine.confirmAllWorked")}
            </button>
          ) : undefined
        }
      />
      {loading ? (
        <p className="text-sm text-neutral-400">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="task_alt" title="travel.toil.mine.empty" description="travel.toil.mine.emptyHint" />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{r.candidate_date}</p>
                  <p className="text-xs text-neutral-500">
                    {REASON_LABEL[r.reason ?? ""] ?? r.reason} · {r.travel_request?.reference_number ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["worked", "travelled", "did_not_work"] as Confirmation[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setChoice((prev) => ({ ...prev, [r.id]: opt }))}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        choice[r.id] === opt
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      {t(`travel.toil.mine.${opt === "did_not_work" ? "didNotWork" : opt}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={t("travel.toil.mine.commentLabel")}
                  className="form-input flex-1 min-w-[200px] text-sm"
                  value={comment[r.id] ?? ""}
                  onChange={(e) => setComment((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  disabled={busyId === r.id}
                />
                <button
                  type="button"
                  className="btn-primary py-1.5 px-3 text-xs"
                  disabled={busyId === r.id}
                  onClick={() => {
                    const c = choice[r.id];
                    if (!c) {
                      error(t("travel.toil.mine.selectFirst"));
                      return;
                    }
                    void confirmOne(r.id, c);
                  }}
                >
                  {t("travel.toil.mine.confirmRow")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
