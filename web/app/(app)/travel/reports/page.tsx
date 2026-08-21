"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi } from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";

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

type SliceColumn = {
  key: string;
  label: string;
  kind?: "date" | "money" | "programme" | "traveller" | "status" | "reference";
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  rejected: "Rejected",
  draft: "Draft",
  cancelled: "Cancelled",
  withdrawn: "Withdrawn",
  returned_for_correction: "Returned",
  amendment_pending: "Amendment pending",
  completed: "Completed",
  retired: "Retired",
  pending: "Pending",
  not_required: "Not required",
};

const PACK_SLICES: { key: string; label: string; description: string; icon: string; columns: SliceColumn[] }[] = [
  {
    key: "travel_register",
    label: "Travel register",
    description: "Named travellers, programmes, and trip dates — not request IDs.",
    icon: "menu_book",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "requester", label: "Traveller", kind: "traveller" },
      { key: "purpose", label: "Purpose" },
      { key: "destination_country", label: "Destination" },
      { key: "programme", label: "Programme", kind: "programme" },
      { key: "departure_date", label: "Departure", kind: "date" },
      { key: "return_date", label: "Return", kind: "date" },
      { key: "status", label: "Status", kind: "status" },
    ],
  },
  {
    key: "upcoming_travel",
    label: "Upcoming travel",
    description: "Approved trips that have not yet departed.",
    icon: "flight_takeoff",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "requester", label: "Traveller", kind: "traveller" },
      { key: "destination_country", label: "Destination" },
      { key: "departure_date", label: "Departure", kind: "date" },
      { key: "return_date", label: "Return", kind: "date" },
    ],
  },
  {
    key: "current_travellers",
    label: "Away now",
    description: "Travellers currently on an approved trip.",
    icon: "luggage",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "requester", label: "Traveller", kind: "traveller" },
      { key: "destination_country", label: "Destination" },
      { key: "departure_date", label: "Departure", kind: "date" },
      { key: "return_date", label: "Return", kind: "date" },
    ],
  },
  {
    key: "by_department",
    label: "By department",
    description: "Trip counts and DSA by the traveller’s department.",
    icon: "apartment",
    columns: [
      { key: "department", label: "Department" },
      { key: "travel_count", label: "Travels" },
      { key: "cost_total", label: "Cost", kind: "money" },
    ],
  },
  {
    key: "by_programme",
    label: "By programme",
    description: "Named programmes and their travel cost.",
    icon: "account_tree",
    columns: [
      { key: "programme", label: "Programme", kind: "programme" },
      { key: "travel_count", label: "Travels" },
      { key: "cost_total", label: "Cost", kind: "money" },
    ],
  },
  {
    key: "by_donor",
    label: "By donor",
    description: "Funding agencies and donor lines.",
    icon: "volunteer_activism",
    columns: [
      { key: "donor", label: "Donor / agency" },
      { key: "travel_count", label: "Travels" },
      { key: "amount_total", label: "Amount", kind: "money" },
    ],
  },
  {
    key: "dsa_summary",
    label: "DSA summary",
    description: "Finance-confirmed daily subsistence totals.",
    icon: "payments",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "requester", label: "Traveller", kind: "traveller" },
      { key: "destination_country", label: "Destination" },
      { key: "finance_dsa_total", label: "Finance DSA", kind: "money" },
      { key: "meal_deduction_total", label: "Meal deduction", kind: "money" },
      { key: "finance_status", label: "Finance status", kind: "status" },
    ],
  },
  {
    key: "cancellations",
    label: "Cancellations",
    description: "Cancelled requisitions with the recorded reason.",
    icon: "event_busy",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "requester", label: "Traveller", kind: "traveller" },
      { key: "destination_country", label: "Destination" },
      { key: "cancelled_at", label: "Cancelled", kind: "date" },
      { key: "cancellation_reason", label: "Reason" },
    ],
  },
  {
    key: "outstanding_retirement",
    label: "Outstanding retirement",
    description: "Returned travellers whose retirement is still open.",
    icon: "assignment_late",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "requester", label: "Traveller", kind: "traveller" },
      { key: "returned_at", label: "Returned", kind: "date" },
      { key: "retirement_due_at", label: "Retirement due", kind: "date" },
      { key: "retirement_status", label: "Status", kind: "status" },
    ],
  },
  {
    key: "toil_candidates",
    label: "TOIL candidates",
    description: "Time-off-in-lieu candidates linked to travel.",
    icon: "schedule",
    columns: [
      { key: "user_id", label: "Traveller", kind: "traveller" },
      { key: "candidate_date", label: "Date", kind: "date" },
      { key: "reason", label: "Reason" },
      { key: "status", label: "Status", kind: "status" },
      { key: "hours", label: "Hours" },
      { key: "expires_at", label: "Expires", kind: "date" },
    ],
  },
  {
    key: "visa_status",
    label: "Visa watchlist",
    description: "Visa requirements and expiry dates.",
    icon: "badge",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "requester", label: "Traveller", kind: "traveller" },
      { key: "visa_status", label: "Visa status", kind: "status" },
      { key: "visa_expiry_date", label: "Expiry", kind: "date" },
      { key: "departure_date", label: "Departure", kind: "date" },
    ],
  },
  {
    key: "amendments",
    label: "Amendments",
    description: "Proposed trip changes awaiting or completing review.",
    icon: "edit_note",
    columns: [
      { key: "reference_number", label: "Reference", kind: "reference" },
      { key: "status", label: "Status", kind: "status" },
      { key: "reason", label: "Reason" },
      { key: "created_at", label: "Raised", kind: "date" },
    ],
  },
  {
    key: "cost_by_destination",
    label: "Cost by destination",
    description: "DSA cost grouped by destination country.",
    icon: "public",
    columns: [
      { key: "destination_country", label: "Destination" },
      { key: "travel_count", label: "Travels" },
      { key: "cost_total", label: "Cost", kind: "money" },
    ],
  },
  {
    key: "cost_by_traveller",
    label: "Cost by traveller",
    description: "Named travellers and their cumulative travel cost.",
    icon: "group",
    columns: [
      { key: "traveller", label: "Traveller", kind: "traveller" },
      { key: "travel_count", label: "Travels" },
      { key: "cost_total", label: "Cost", kind: "money" },
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

function humanStatus(status: unknown): string {
  if (status == null || status === "") return "—";
  const raw = String(status);
  return STATUS_LABELS[raw] ?? raw.replace(/_/g, " ");
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

function programmeName(row: Record<string, unknown>): string {
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
  return "Unassigned";
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

function referenceLabel(row: Record<string, unknown>): string {
  if (typeof row.reference_number === "string" && row.reference_number.trim()) return row.reference_number.trim();
  const nested = asRecord(row.travel_request);
  if (nested && typeof nested.reference_number === "string" && nested.reference_number.trim()) {
    return nested.reference_number.trim();
  }
  return "Open request";
}

function cellFor(
  column: SliceColumn,
  row: Record<string, unknown>,
  sliceKey: string,
  names: Map<number, string>,
) {
  if (column.kind === "date") return formatDateShort(row[column.key] as string | Date | null | undefined);
  if (column.kind === "money") {
    const currency = typeof row.currency === "string" && row.currency.trim() ? row.currency : "NAD";
    return money(row[column.key], currency);
  }
  if (column.kind === "programme") return programmeName(row);
  if (column.kind === "traveller") return travellerName(row, names);
  if (column.kind === "status") return humanStatus(row[column.key]);
  if (column.kind === "reference") {
    const href = travelHref(sliceKey, row);
    const label = referenceLabel(row);
    if (href) {
      return (
        <Link href={href} className="font-medium text-primary hover:underline">
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
      .catch(() => setError("Failed to load travel reports."))
      .finally(() => setLoading(false));
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
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Travel Reports"
        subtitle="Secretariat briefing pack: status, programme cost, donor lines, and exportable register slices."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Travel", href: "/travel" },
              { label: "Reports" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/travel/register" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              Register
            </Link>
            <Link href="/travel/calendar" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              Calendar
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="card space-y-3 p-6" aria-live="polite">
          <p className="text-sm text-neutral-500">Loading travel reports…</p>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && !hasAnalytics && !hasPackRows ? (
        <div className="card">
          <EmptyState
            icon="analytics"
            title="No travel reports yet"
            description="Analytics and pack slices appear once travel requisitions exist for this Secretariat."
            action={
              <Link href="/travel/create" className="btn-primary text-sm">
                New request
              </Link>
            }
          />
        </div>
      ) : null}

      {!loading && !error && data ? (
        <>
          <FormSection
            title="Totals"
            description="Live analytics for this Secretariat — finance DSA is confirmed cost, estimated DSA is still in draft or review."
            icon="monitoring"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="travel-analytics-totals">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">Requests</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{data.totals.requests}</p>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">Finance DSA total</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(data.totals.finance_dsa_total)}</p>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">Estimated DSA total</p>
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

          <FormSection title="By status" description="How the live travel register is distributed across workflow states." icon="flag">
            {Object.keys(data.by_status).length === 0 ? (
              <EmptyState icon="flag" title="No status counts" description="Status totals appear after the first requisition is saved." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.by_status).map(([status, count]) => (
                      <tr key={status}>
                        <td>{humanStatus(status)}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection
            title="Cost by programme"
            description="Named work programmes, never programme numbers as the label."
            icon="account_tree"
          >
            {data.cost_by_programme.length === 0 ? (
              <EmptyState
                icon="account_tree"
                title="No programme-linked travel"
                description="Costs appear here when requisitions are linked to a named programme."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Programme</th>
                      <th>Travels</th>
                      <th>DSA total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cost_by_programme.map((row, index) => (
                      <tr key={`${programmeName(row)}-${index}`}>
                        <td>{programmeName(row)}</td>
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
            title="Cost by funding agency"
            description="Donor and agency lines recorded on travel funding."
            icon="volunteer_activism"
          >
            {data.cost_by_funding_agency.length === 0 ? (
              <EmptyState
                icon="volunteer_activism"
                title="No funding lines yet"
                description="Agency totals appear when funding agencies are captured on a requisition."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Funding agency</th>
                      <th>Travels</th>
                      <th>Amount</th>
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
          title="Reports pack"
          description={activeSlice.description}
          icon="folder_open"
          actions={
            <a
              className="btn-secondary text-sm"
              href={travelApi.reportsPackExportUrl(activeSlice.key)}
              target="_blank"
              rel="noreferrer"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download CSV
            </a>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              label="Report slice"
              htmlFor="travel-report-slice"
              hint="Choose a labelled pack slice. The CSV export matches the open slice."
            >
              <select
                id="travel-report-slice"
                className="form-input"
                value={activeSlice.key}
                onChange={(event) => setSliceKey(event.target.value)}
              >
                {PACK_SLICES.map((slice) => (
                  <option key={slice.key} value={slice.key}>
                    {slice.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" data-testid="travel-reports-pack" role="tablist" aria-label="Report pack slices">
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
                  {slice.label}
                  <span className="ml-1.5 text-[11px] text-neutral-500">{packCounts[slice.key] ?? 0}</span>
                </button>
              );
            })}
          </div>

          {sliceRows.length === 0 ? (
            <EmptyState
              icon={activeSlice.icon}
              title={`No ${activeSlice.label.toLowerCase()} rows`}
              description="This pack slice is empty for the current Secretariat. Export still downloads a CSV header."
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    {activeSlice.columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sliceRows.map((row, index) => (
                    <tr key={`${activeSlice.key}-${index}`}>
                      {activeSlice.columns.map((column) => (
                        <td key={column.key}>{cellFor(column, row, activeSlice.key, travellerNames)}</td>
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
