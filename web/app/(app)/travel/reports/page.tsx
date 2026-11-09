"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi } from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Analytics = {
  by_status: Record<string, number>;
  cost_by_programme: {
    programme_title?: string | null;
    programme_reference?: string | null;
    travel_count: number;
    dsa_total: number;
  }[];
  cost_by_funding_agency: { funding_agency: string; amount_total: number; travel_count: number }[];
  totals: { requests: number; finance_dsa_total: number; estimated_dsa_total: number };
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

type SliceColumn = {
  key: string;
  label: string;
  kind?: "date" | "money" | "programme" | "traveller" | "status" | "reference";
};

/** Labels in these constants are catalog keys, translated where they render. */
const STATUS_LABELS: Record<string, string> = {
  approved: "travel.reports.status.approved",
  submitted: "travel.reports.status.submitted",
  resubmitted: "travel.reports.status.resubmitted",
  rejected: "travel.reports.status.rejected",
  draft: "travel.reports.status.draft",
  cancelled: "travel.reports.status.cancelled",
  withdrawn: "travel.reports.status.withdrawn",
  returned_for_correction: "travel.reports.status.returnedForCorrection",
  amendment_pending: "travel.reports.status.amendmentPending",
  completed: "travel.reports.status.completed",
  retired: "travel.reports.status.retired",
  pending: "travel.reports.status.pending",
  not_required: "travel.reports.status.notRequired",
};

const PACK_SLICES: { key: string; label: string; description: string; icon: string; columns: SliceColumn[] }[] = [
  {
    key: "travel_register",
    label: "travel.reports.slice.travelRegister.label",
    description: "travel.reports.slice.travelRegister.description",
    icon: "menu_book",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "requester", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "purpose", label: "travel.reports.col.purpose" },
      { key: "destination_country", label: "travel.reports.col.destination" },
      { key: "programme", label: "travel.reports.col.programme", kind: "programme" },
      { key: "departure_date", label: "travel.reports.col.departure", kind: "date" },
      { key: "return_date", label: "travel.reports.col.return", kind: "date" },
      { key: "status", label: "travel.reports.col.status", kind: "status" },
    ],
  },
  {
    key: "upcoming_travel",
    label: "travel.reports.slice.upcomingTravel.label",
    description: "travel.reports.slice.upcomingTravel.description",
    icon: "flight_takeoff",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "requester", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "destination_country", label: "travel.reports.col.destination" },
      { key: "departure_date", label: "travel.reports.col.departure", kind: "date" },
      { key: "return_date", label: "travel.reports.col.return", kind: "date" },
    ],
  },
  {
    key: "current_travellers",
    label: "travel.reports.slice.currentTravellers.label",
    description: "travel.reports.slice.currentTravellers.description",
    icon: "luggage",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "requester", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "destination_country", label: "travel.reports.col.destination" },
      { key: "departure_date", label: "travel.reports.col.departure", kind: "date" },
      { key: "return_date", label: "travel.reports.col.return", kind: "date" },
    ],
  },
  {
    key: "by_department",
    label: "travel.reports.slice.byDepartment.label",
    description: "travel.reports.slice.byDepartment.description",
    icon: "apartment",
    columns: [
      { key: "department", label: "travel.reports.col.department" },
      { key: "travel_count", label: "travel.reports.col.travels" },
      { key: "cost_total", label: "travel.reports.col.cost", kind: "money" },
    ],
  },
  {
    key: "by_programme",
    label: "travel.reports.slice.byProgramme.label",
    description: "travel.reports.slice.byProgramme.description",
    icon: "account_tree",
    columns: [
      { key: "programme", label: "travel.reports.col.programme", kind: "programme" },
      { key: "travel_count", label: "travel.reports.col.travels" },
      { key: "cost_total", label: "travel.reports.col.cost", kind: "money" },
    ],
  },
  {
    key: "by_donor",
    label: "travel.reports.slice.byDonor.label",
    description: "travel.reports.slice.byDonor.description",
    icon: "volunteer_activism",
    columns: [
      { key: "donor", label: "travel.reports.col.donor" },
      { key: "travel_count", label: "travel.reports.col.travels" },
      { key: "amount_total", label: "travel.reports.col.amount", kind: "money" },
    ],
  },
  {
    key: "dsa_summary",
    label: "travel.reports.slice.dsaSummary.label",
    description: "travel.reports.slice.dsaSummary.description",
    icon: "payments",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "requester", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "destination_country", label: "travel.reports.col.destination" },
      { key: "finance_dsa_total", label: "travel.reports.col.financeDsa", kind: "money" },
      { key: "meal_deduction_total", label: "travel.reports.col.mealDeduction", kind: "money" },
      { key: "finance_status", label: "travel.reports.col.financeStatus", kind: "status" },
    ],
  },
  {
    key: "cancellations",
    label: "travel.reports.slice.cancellations.label",
    description: "travel.reports.slice.cancellations.description",
    icon: "event_busy",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "requester", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "destination_country", label: "travel.reports.col.destination" },
      { key: "cancelled_at", label: "travel.reports.col.cancelled", kind: "date" },
      { key: "cancellation_reason", label: "travel.reports.col.reason" },
    ],
  },
  {
    key: "outstanding_retirement",
    label: "travel.reports.slice.outstandingRetirement.label",
    description: "travel.reports.slice.outstandingRetirement.description",
    icon: "assignment_late",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "requester", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "returned_at", label: "travel.reports.col.returned", kind: "date" },
      { key: "retirement_due_at", label: "travel.reports.col.retirementDue", kind: "date" },
      { key: "retirement_status", label: "travel.reports.col.status", kind: "status" },
    ],
  },
  {
    key: "toil_candidates",
    label: "travel.reports.slice.toilCandidates.label",
    description: "travel.reports.slice.toilCandidates.description",
    icon: "schedule",
    columns: [
      { key: "user_id", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "candidate_date", label: "travel.reports.col.date", kind: "date" },
      { key: "reason", label: "travel.reports.col.reason" },
      { key: "status", label: "travel.reports.col.status", kind: "status" },
      { key: "hours", label: "travel.reports.col.hours" },
      { key: "expires_at", label: "travel.reports.col.expires", kind: "date" },
    ],
  },
  {
    key: "visa_status",
    label: "travel.reports.slice.visaStatus.label",
    description: "travel.reports.slice.visaStatus.description",
    icon: "badge",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "requester", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "visa_status", label: "travel.reports.col.visaStatus", kind: "status" },
      { key: "visa_expiry_date", label: "travel.reports.col.expiry", kind: "date" },
      { key: "departure_date", label: "travel.reports.col.departure", kind: "date" },
    ],
  },
  {
    key: "amendments",
    label: "travel.reports.slice.amendments.label",
    description: "travel.reports.slice.amendments.description",
    icon: "edit_note",
    columns: [
      { key: "reference_number", label: "travel.reports.col.reference", kind: "reference" },
      { key: "status", label: "travel.reports.col.status", kind: "status" },
      { key: "reason", label: "travel.reports.col.reason" },
      { key: "created_at", label: "travel.reports.col.raised", kind: "date" },
    ],
  },
  {
    key: "cost_by_destination",
    label: "travel.reports.slice.costByDestination.label",
    description: "travel.reports.slice.costByDestination.description",
    icon: "public",
    columns: [
      { key: "destination_country", label: "travel.reports.col.destination" },
      { key: "travel_count", label: "travel.reports.col.travels" },
      { key: "cost_total", label: "travel.reports.col.cost", kind: "money" },
    ],
  },
  {
    key: "cost_by_traveller",
    label: "travel.reports.slice.costByTraveller.label",
    description: "travel.reports.slice.costByTraveller.description",
    icon: "group",
    columns: [
      { key: "traveller", label: "travel.reports.col.traveller", kind: "traveller" },
      { key: "travel_count", label: "travel.reports.col.travels" },
      { key: "cost_total", label: "travel.reports.col.cost", kind: "money" },
    ],
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
}

function humanStatus(status: unknown, t: Translate): string {
  if (status == null || status === "") return "—";
  const raw = String(status);
  return STATUS_LABELS[raw] ? t(STATUS_LABELS[raw]) : raw.replace(/_/g, " ");
}

function money(value: unknown, currency = "NAD"): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  const code = /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : "NAD";
  try {
    return formatCurrency(amount, code);
  } catch {
    return formatCurrency(amount, "NAD");
  }
}

function destinationOf(row: Record<string, unknown>): string {
  const city = typeof row.destination_city === "string" ? row.destination_city.trim() : "";
  const country = typeof row.destination_country === "string" ? row.destination_country.trim() : "";
  return [city, country].filter(Boolean).join(", ") || "—";
}

function programmeName(row: Record<string, unknown>, t: Translate): string {
  const nested = asRecord(row.programme);
  if (nested) {
    const title = nested.title ?? nested.name ?? nested.label;
    const ref = nested.reference_number ?? nested.reference;
    const titleText = title != null && String(title).trim() ? String(title).trim() : "";
    const refText = ref != null && String(ref).trim() ? String(ref).trim() : "";
    if (titleText && refText) return `${refText} · ${titleText}`;
    if (titleText) return titleText;
    if (refText) return refText;
  }
  if (typeof row.programme === "string" && row.programme.trim()) return row.programme.trim();
  const title = typeof row.programme_title === "string" ? row.programme_title.trim() : "";
  const ref = typeof row.programme_reference === "string" ? row.programme_reference.trim() : "";
  if (title && ref) return `${ref} · ${title}`;
  if (title) return title;
  if (ref) return ref;
  return t("travel.reports.unassigned");
}

function travellerName(row: Record<string, unknown>, names: Map<number, string>): string {
  if (typeof row.traveller === "string" && row.traveller.trim()) return row.traveller.trim();
  const requester = asRecord(row.requester);
  if (requester) {
    const labelled = requester.name ?? requester.title ?? requester.label;
    if (labelled != null && String(labelled).trim()) return String(labelled).trim();
  }
  if (typeof row.requester_name === "string" && row.requester_name.trim()) return row.requester_name.trim();
  const candidate = Number(row.requester_id ?? row.user_id);
  if (Number.isFinite(candidate) && names.has(candidate)) return names.get(candidate) ?? "—";
  return "—";
}

function travelHref(sliceKey: string, row: Record<string, unknown>): string | null {
  const raw =
    sliceKey === "toil_candidates" || sliceKey === "amendments" ? row.travel_request_id : row.id;
  const id = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return `/travel/${id}`;
}

function referenceLabel(row: Record<string, unknown>, t: Translate): string {
  if (typeof row.reference_number === "string" && row.reference_number.trim()) return row.reference_number.trim();
  const nested = asRecord(row.travel_request);
  if (nested && typeof nested.reference_number === "string" && nested.reference_number.trim()) {
    return nested.reference_number.trim();
  }
  return t("travel.reports.openRequest");
}

function cellFor(
  column: SliceColumn,
  row: Record<string, unknown>,
  sliceKey: string,
  names: Map<number, string>,
  t: Translate,
) {
  if (column.kind === "date") return formatDateShort(row[column.key] as string | Date | null | undefined);
  if (column.kind === "money") {
    const currency = typeof row.currency === "string" && row.currency.trim() ? row.currency : "NAD";
    return money(row[column.key], currency);
  }
  if (column.kind === "programme") return programmeName(row, t);
  if (column.kind === "traveller") return travellerName(row, names);
  if (column.kind === "status") return humanStatus(row[column.key], t);
  if (column.kind === "reference") {
    const href = travelHref(sliceKey, row);
    const label = referenceLabel(row, t);
    if (href) {
      return (
        <Link href={href} className="font-medium text-primary">
          {label}
        </Link>
      );
    }
    return label;
  }
  if (column.key === "destination_country") return destinationOf(row);
  const value = row[column.key];
  if (value && typeof value === "object") return labelledObjectCell(value);
  if (value == null || value === "") return "—";
  return String(value);
}

export default function TravelReportsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Analytics | null>(null);
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);
  const [travellerNames, setTravellerNames] = useState<Map<number, string>>(new Map());
  const [sliceKey, setSliceKey] = useState("travel_register");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      travelApi.analyticsSummary().then((r) => r.data.data),
      travelApi.reportsPack().then((r) => r.data.data),
      travelApi.travellers().then((r) => r.data.data).catch(() => []),
    ])
      .then(([analytics, reports, travellers]) => {
        setData(analytics);
        setPack(reports);
        const names = new Map<number, string>();
        for (const person of travellers) {
          if (person?.id && person.name) names.set(person.id, person.name);
        }
        setTravellerNames(names);
      })
      .catch(() => setError(t("travel.reports.loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeSlice = PACK_SLICES.find((slice) => slice.key === sliceKey) ?? PACK_SLICES[0];
  const sliceRows = asRows(pack?.[activeSlice.key]);
  const packCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slice of PACK_SLICES) {
      counts[slice.key] = asRows(pack?.[slice.key]).length;
    }
    return counts;
  }, [pack]);

  const hasAnalytics = Boolean(
    data &&
      (data.totals.requests > 0 ||
        Object.keys(data.by_status).length > 0 ||
        data.cost_by_programme.length > 0 ||
        data.cost_by_funding_agency.length > 0),
  );
  const hasPackRows = Object.values(packCounts).some((count) => count > 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("travel.reports.title")}
        subtitle={t("travel.reports.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("nav.travel"), href: "/travel" },
              { label: t("salaryAdvances.common.reports") },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/travel/register" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              {t("salaryAdvances.common.register")}
            </Link>
            <Link href="/travel/calendar" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              {t("travel.calendar.crumb")}
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="card space-y-3 p-6" aria-live="polite">
          <p className="text-sm text-neutral-500">{t("travel.reports.loading")}</p>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="btn-secondary text-xs" onClick={load}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {!loading && !error && !hasAnalytics && !hasPackRows ? (
        <div className="card">
          <EmptyState
            icon="analytics"
            title={t("travel.reports.empty")}
            description={t("travel.reports.emptyHint")}
            action={
              <Link href="/travel/create" className="btn-primary text-sm">
                {t("travel.hub.newRequest")}
              </Link>
            }
          />
        </div>
      ) : null}

      {!loading && !error && data ? (
        <>
          <FormSection
            title={t("travel.reports.totals")}
            description={t("travel.reports.totalsHint")}
            icon="monitoring"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="travel-analytics-totals">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">{t("travel.reports.requests")}</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{data.totals.requests}</p>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">{t("travel.reports.financeTotal")}</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(data.totals.finance_dsa_total)}</p>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">{t("travel.reports.estimatedTotal")}</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(data.totals.estimated_dsa_total)}</p>
              </div>
            </div>
            <div className="mt-4">
              <LabelledRecord
                value={{
                  requests: data.totals.requests,
                  finance_dsa_total: money(data.totals.finance_dsa_total),
                  estimated_dsa_total: money(data.totals.estimated_dsa_total),
                }}
              />
            </div>
          </FormSection>

          <FormSection title={t("travel.reports.byStatus")} description={t("travel.reports.byStatusHint")} icon="flag">
            {Object.keys(data.by_status).length === 0 ? (
              <EmptyState icon="flag" title={t("travel.reports.noStatus")} description={t("travel.reports.noStatusHint")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{t("travel.reports.col.status")}</th>
                      <th>{t("travel.reports.requests")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.by_status).map(([status, count]) => (
                      <tr key={status}>
                        <td>{humanStatus(status, t)}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection
            title={t("travel.financeDash.costByProgramme")}
            description={t("travel.reports.costByProgrammeHint")}
            icon="account_tree"
          >
            {data.cost_by_programme.length === 0 ? (
              <EmptyState
                icon="account_tree"
                title={t("travel.reports.noProgramme")}
                description={t("travel.reports.noProgrammeHint")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{t("travel.reports.col.programme")}</th>
                      <th>{t("travel.reports.col.travels")}</th>
                      <th>{t("travel.reports.dsaTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cost_by_programme.map((row, index) => (
                      <tr key={`${programmeName(row, t)}-${index}`}>
                        <td>{programmeName(row, t)}</td>
                        <td>{row.travel_count}</td>
                        <td>{money(row.dsa_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection
            title={t("travel.reports.costByAgency")}
            description={t("travel.reports.costByAgencyHint")}
            icon="volunteer_activism"
          >
            {data.cost_by_funding_agency.length === 0 ? (
              <EmptyState
                icon="volunteer_activism"
                title={t("travel.reports.noFunding")}
                description={t("travel.reports.noFundingHint")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{t("travel.reports.fundingAgency")}</th>
                      <th>{t("travel.reports.col.travels")}</th>
                      <th>{t("travel.reports.col.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cost_by_funding_agency.map((row) => (
                      <tr key={row.funding_agency}>
                        <td>{row.funding_agency}</td>
                        <td>{row.travel_count}</td>
                        <td>{money(row.amount_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>
        </>
      ) : null}

      {!loading && !error && pack ? (
        <FormSection
          title={t("travel.reports.pack")}
          description={t(activeSlice.description)}
          icon="folder_open"
          actions={
            <a
              className="btn-secondary text-sm"
              href={travelApi.reportsPackExportUrl(activeSlice.key)}
              target="_blank"
              rel="noreferrer"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t("salaryAdvances.reports.download")}
            </a>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              label={t("travel.reports.slice")}
              htmlFor="travel-report-slice"
              hint={t("travel.reports.sliceHint")}
            >
              <select
                id="travel-report-slice"
                className="form-input"
                value={activeSlice.key}
                onChange={(event) => setSliceKey(event.target.value)}
              >
                {PACK_SLICES.map((slice) => (
                  <option key={slice.key} value={slice.key}>
                    {t(slice.label)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" data-testid="travel-reports-pack" role="tablist" aria-label={t("travel.reports.slicesAria")}>
            {PACK_SLICES.map((slice) => {
              const selected = slice.key === activeSlice.key;
              return (
                <button
                  key={slice.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`filter-tab ${selected ? "active" : ""}`}
                  onClick={() => setSliceKey(slice.key)}
                >
                  {t(slice.label)}
                  <span className="ml-1.5 text-[11px] text-neutral-500">{packCounts[slice.key] ?? 0}</span>
                </button>
              );
            })}
          </div>

          {sliceRows.length === 0 ? (
            <EmptyState
              icon={activeSlice.icon}
              title={t("travel.reports.sliceEmpty", { slice: t(activeSlice.label).toLowerCase() })}
              description={t("travel.reports.sliceEmptyHint")}
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    {activeSlice.columns.map((column) => (
                      <th key={column.key}>{t(column.label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sliceRows.map((row, index) => (
                    <tr key={`${activeSlice.key}-${index}`}>
                      {activeSlice.columns.map((column) => (
                        <td key={column.key}>{cellFor(column, row, activeSlice.key, travellerNames, t)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormSection>
      ) : null}
    </div>
  );
}
