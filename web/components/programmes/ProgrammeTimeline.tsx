"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { programmeTimelineApi, type ProgrammeTimelineEvent } from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** `label` values are catalog keys, translated where they render. */
const TYPE_META: Record<ProgrammeTimelineEvent["type"], { label: string; icon: string }> = {
  programme: { label: "programmes.timeline.type.programme", icon: "assignment" },
  procurement_request: { label: "programmes.timeline.type.procurementRequest", icon: "shopping_cart" },
  purchase_order: { label: "programmes.timeline.type.purchaseOrder", icon: "receipt_long" },
  contract: { label: "programmes.timeline.type.contract", icon: "handshake" },
  travel_request: { label: "programmes.timeline.type.travel", icon: "flight_takeoff" },
  me_report: { label: "programmes.timeline.type.meReport", icon: "insights" },
};

const DEFINITION_LABEL: Record<string, string> = {
  requested_procurement_estimate: "programmes.timeline.def.procurementEstimates",
  purchase_order_value: "programmes.timeline.def.purchaseOrders",
  contract_value: "programmes.timeline.def.contracts",
};

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Programme lifecycle plus linked records the viewer can access in their own modules. */
export function ProgrammeTimeline({ programmeId }: { programmeId: number }) {
  const { fmt } = useFormatDate();
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["programmes", "timeline", programmeId],
    queryFn: () => programmeTimelineApi.get(programmeId).then((r) => r.data.data),
  });

  if (isLoading) {
    return <div className="card space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />)}</div>;
  }
  if (isError || !data) {
    return (
      <div className="card px-5 py-4 text-sm text-red-700" role="alert">
        {t("programmes.timeline.loadFailed")}{" "}
        <button type="button" className="font-semibold hover:opacity-80" onClick={() => refetch()}>{t("programmes.timeline.tryAgain")}</button>
      </div>
    );
  }

  const currencies = Object.entries(data.financials.linked_values_by_currency);
  const budget = data.financials.approved_budget;

  return (
    <div className="space-y-4">
      <section className="card p-5" aria-labelledby="pif-timeline-financials">
        <h3 id="pif-timeline-financials" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("programmes.timeline.linkedValues")}</h3>
        <p className="mt-1 text-xs text-neutral-500">{data.financials.definitions.note}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {budget.amount !== null && budget.currency ? (
            <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              <dt className="text-xs text-neutral-500">{t("programmes.timeline.approvedBudget")}</dt>
              <dd className="text-sm font-semibold">{money(budget.amount, budget.currency)}</dd>
            </div>
          ) : null}
          {currencies.flatMap(([currency, defs]) =>
            Object.entries(defs).map(([def, amount]) => (
              <div key={`${currency}-${def}`} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700" title={data.financials.definitions[def]}>
                <dt className="text-xs text-neutral-500">{DEFINITION_LABEL[def] ? t(DEFINITION_LABEL[def]) : def} ({currency})</dt>
                <dd className="text-sm font-semibold">{money(amount, currency)}</dd>
              </div>
            ))
          )}
        </dl>
      </section>

      <section className="card p-0 overflow-hidden" aria-labelledby="pif-timeline-events">
        <h3 id="pif-timeline-events" className="border-b border-neutral-200 px-5 py-4 text-sm font-semibold text-neutral-900 dark:border-neutral-700 dark:text-neutral-100">
          {t("programmes.timeline.title")}
        </h3>
        {data.events.length === 0 ? (
          <EmptyState icon="timeline" title={t("programmes.timeline.empty")} description={t("programmes.timeline.emptyHint")} />
        ) : (
          <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.events.map((e) => (
              <li key={`${e.type}-${e.id}-${e.kind}-${e.at}`}>
                <Link href={e.path} className="flex items-start gap-3 px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">{TYPE_META[e.type]?.icon ?? "circle"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{e.title ?? (TYPE_META[e.type] ? t(TYPE_META[e.type].label) : "")}</p>
                    <p className="text-xs text-neutral-500">
                      {TYPE_META[e.type] ? t(TYPE_META[e.type].label) : ""}
                      {e.reference ? ` · ${e.reference}` : ""}
                      {e.status ? ` · ${e.status.replace(/_/g, " ")}` : ""}
                      {e.amount !== null && e.currency ? ` · ${money(e.amount, e.currency)}` : ""}
                    </p>
                  </div>
                  {e.at ? <time className="flex-shrink-0 text-xs text-neutral-500" dateTime={e.at}>{fmt(e.at)}</time> : null}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
