"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  procurementApi,
  supplierCategoriesApi,
  type ProcurementRequest,
  type SupplierCategory,
} from "@/lib/api";
import { canIssueProcurementRfq, canViewProcurementRfq, getStoredUser } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/apiError";
import { isBudgetConfirmed } from "@/lib/procurementBudget";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

type RfqFilter = "all" | "open" | "in_progress" | "ready";
type ExternalInvite = { name: string; email: string };

function rfqFilter(req: ProcurementRequest): RfqFilter {
  const quotes = req.quotes ?? [];
  if (quotes.length === 0) return "open";
  return "in_progress";
}

function rfqBadge(filter: RfqFilter) {
  if (filter === "open")        return { label: "procurement.rfq.open",     cls: "badge-warning", icon: "hourglass_empty" };
  if (filter === "in_progress") return { label: "procurement.rfq.quotesIn", cls: "badge-primary", icon: "rate_review" };
  return                              { label: "procurement.rfq.open",     cls: "badge-warning", icon: "hourglass_empty" };
}

const FILTERS: { key: RfqFilter | "awarded"; label: string }[] = [
  { key: "all",         label: "procurement.filter.all" },
  { key: "open",        label: "procurement.rfq.open" },
  { key: "in_progress", label: "procurement.rfq.quotesIn" },
  { key: "awarded",     label: "procurement.rfq.awarded" },
];

export default function RfqListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const { t } = useI18n();
  const canViewRfq = canViewProcurementRfq(user);
  const canIssueRfq = canIssueProcurementRfq(user);

  const [tab, setTab] = useState<RfqFilter | "awarded">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | "">("");
  const [rfqDeadline, setRfqDeadline] = useState("");
  const [rfqNotes, setRfqNotes] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [externalInvites, setExternalInvites] = useState<ExternalInvite[]>([{ name: "", email: "" }]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: approvedData, isLoading: loadingApproved } = useQuery({
    queryKey: ["rfq-approved"],
    queryFn: () => procurementApi.list({ status: "approved", per_page: 100 }).then((r) => r.data),
    enabled: canViewRfq,
  });

  const { data: awardedData, isLoading: loadingAwarded } = useQuery({
    queryKey: ["rfq-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
    enabled: canViewRfq,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data as SupplierCategory[]),
    enabled: canIssueRfq && showCreate,
  });

  const approved: ProcurementRequest[] = (approvedData as { data?: ProcurementRequest[] })?.data ?? [];
  const awarded: ProcurementRequest[] = (awardedData as { data?: ProcurementRequest[] })?.data ?? [];
  const awaitingBudget = useMemo(
    () => approved.filter((request) => !request.rfq_issued_at && request.status === "approved" && !isBudgetConfirmed(request)),
    [approved]
  );
  const eligibleRequests = useMemo(
    () =>
      approved.filter(
        (request) => !request.rfq_issued_at && request.status === "approved" && isBudgetConfirmed(request),
      ),
    [approved]
  );
  const selectedRequest = eligibleRequests.find((request) => request.id === selectedRequestId) ?? null;

  useEffect(() => {
    if (!showCreate || selectedRequestId || eligibleRequests.length !== 1) return;
    setSelectedRequestId(eligibleRequests[0].id);
  }, [eligibleRequests, selectedRequestId, showCreate]);

  const open = approved.filter((r) => (r.quotes ?? []).length === 0);
  const inProgress = approved.filter((r) => (r.quotes ?? []).length > 0);

  const displayed = (() => {
    if (tab === "awarded") return awarded;
    if (tab === "open") return open;
    if (tab === "in_progress") return inProgress;
    return [...approved, ...awarded];
  })();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return displayed;
    return displayed.filter((r) => {
      const hay = [r.reference_number, r.title, r.status].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [displayed, search]);

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filtered, page, lastPage],
  );

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `procurement-rfq-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        title: r.title,
        status: r.status,
        quotes: (r.quotes ?? []).length,
        deadline: r.rfq_deadline ?? "",
        value: r.estimated_value,
        currency: r.currency,
      })),
      [
        { key: "reference", header: t("procurement.col.reference") },
        { key: "title", header: t("procurement.col.title") },
        { key: "status", header: t("procurement.col.status") },
        { key: "quotes", header: t("procurement.rfq.quotes") },
        { key: "deadline", header: t("procurement.col.deadline") },
        { key: "value", header: t("procurement.col.value") },
        { key: "currency", header: t("procurement.col.currency") },
      ],
    );
  };

  const issueMutation = useMutation({
    mutationFn: async () => {
      const filledExternalInvites = externalInvites
        .filter((invite) => invite.email.trim())
        .map((invite) => ({
          name: invite.name.trim() || undefined,
          email: invite.email.trim(),
        }));

      if (!selectedRequestId) throw new Error(t("procurement.rfq.err.selectRequest"));
      if (categoryIds.length < 1 || categoryIds.length > 3) {
        throw new Error(t("procurement.rfq.err.categories"));
      }

      const invalidEmail = filledExternalInvites.find((invite) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email));
      if (invalidEmail) throw new Error(t("procurement.rfq.err.invalidEmail", { email: invalidEmail.email }));

      return procurementApi.issueRfq(selectedRequestId, {
        rfq_deadline: rfqDeadline || undefined,
        rfq_notes: rfqNotes.trim() || undefined,
        category_ids: categoryIds,
        external_invites: filledExternalInvites,
      });
    },
    onSuccess: async () => {
      const requestId = Number(selectedRequestId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rfq-approved"] }),
        queryClient.invalidateQueries({ queryKey: ["rfq-awarded"] }),
        queryClient.invalidateQueries({ queryKey: ["rfq-request", requestId] }),
      ]);
      setFormError(null);
      setShowCreate(false);
      setSelectedRequestId("");
      setCategoryIds([]);
      setRfqDeadline("");
      setRfqNotes("");
      setExternalInvites([{ name: "", email: "" }]);
      router.push(`/procurement/rfq/${requestId}`);
    },
    onError: (err: unknown) => {
      setFormError(apiErrorMessage(err, t("procurement.rfq.issueFailed")));
    },
  });

  const isLoading = loadingApproved || loadingAwarded;

  if (!canViewRfq) {
    return <div className="card p-6">{t("procurement.rfq.noPermission")}</div>;
  }

  return (
    <div className="space-y-6">
      <ProcurementPageHeader
        title={t("procurement.rfq.title")}
        subtitle={t("procurement.rfq.subtitle")}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: t("procurement.rfq.crumb") },
        ]}
        actions={
          <>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            {t("procurement.exportCsv")}
          </button>
          {canIssueRfq && (
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
              disabled={eligibleRequests.length === 0}
              title={eligibleRequests.length === 0 ? t("procurement.rfq.needsBudgetTitle") : undefined}
              onClick={() => {
                setFormError(null);
                setShowCreate(true);
              }}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t("procurement.rfq.create")}
            </button>
          )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("procurement.rfq.kpi.total"), value: approved.length + awarded.length, icon: "request_quote", color: "text-primary", bg: "bg-primary/10" },
          { label: t("procurement.rfq.open"), value: open.length, icon: "hourglass_empty", color: "text-amber-600", bg: "bg-amber-50" },
          { label: t("procurement.rfq.quotesIn"), value: inProgress.length, icon: "rate_review", color: "text-blue-600", bg: "bg-blue-50" },
          { label: t("procurement.rfq.awarded"), value: awarded.length, icon: "emoji_events", color: "text-green-600", bg: "bg-green-50" },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg} flex-shrink-0`}>
              <span className={`material-symbols-outlined text-[22px] ${k.color}`}>{k.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{k.value}</p>
              <p className="text-xs text-neutral-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder={t("procurement.rfq.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setTab(f.key);
                  setPage(1);
                }}
                className={`filter-tab ${tab === f.key ? "active" : ""}`}
              >
                {t(f.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {canIssueRfq && awaitingBudget.length > 0 && (
        <div className="card p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200">
          {t(awaitingBudget.length === 1 ? "procurement.rfq.awaitingBudgetOne" : "procurement.rfq.awaitingBudgetMany", { count: awaitingBudget.length })}{" "}
          <Link href="/procurement/budget" className="btn-secondary text-xs">
            {t("procurement.rfq.openBudget")}
          </Link>
        </div>
      )}
      {canIssueRfq && eligibleRequests.length === 0 && awaitingBudget.length === 0 && (
        <div className="card p-4 text-sm text-amber-700 bg-amber-50 border-amber-200">
          {t("procurement.rfq.noneReady")}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-neutral-100 rounded" />
                <div className="h-4 w-56 bg-neutral-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="request_quote"
          title={t("procurement.rfq.empty")}
          description={t("procurement.rfq.emptyHint")}
        />
      ) : (
        <div className="card">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th>{t("procurement.col.reference")}</th>
                  <th>{t("procurement.col.title")}</th>
                  <th>{t("procurement.certificate.category")}</th>
                  <th className="text-right">{t("procurement.index.estValue")}</th>
                  <th className="text-center">{t("procurement.rfq.quotes")}</th>
                  <th>{t("procurement.col.deadline")}</th>
                  <th>{t("procurement.col.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((req) => {
                  const quotes = req.quotes ?? [];
                  const isAwarded = req.status === "awarded";
                  const needsBudget = !isAwarded && !isBudgetConfirmed(req);
                  const filter = isAwarded ? ("awarded" as const) : rfqFilter(req);
                  const badge = isAwarded
                    ? { label: "procurement.rfq.awarded", cls: "badge-success", icon: "emoji_events" }
                    : needsBudget
                      ? { label: "procurement.rfq.awaitingBudget", cls: "badge-warning", icon: "account_balance" }
                      : rfqBadge(filter as RfqFilter);
                  const lowest = quotes.length > 0 ? Math.min(...quotes.map((q) => q.quoted_amount)) : null;

                  return (
                    <tr key={req.id}>
                      <td>
                        <Link href={`/procurement/rfq/${req.id}`} className="btn-secondary text-xs font-mono">
                          {req.reference_number}
                        </Link>
                      </td>
                      <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{req.title}</td>
                      <td><span className="text-xs capitalize text-neutral-600">{req.category}</span></td>
                      <td className="text-right text-sm font-semibold text-neutral-900">
                        {req.currency ?? DEFAULT_CURRENCY} {(req.estimated_value ?? 0).toLocaleString()}
                      </td>
                      <td className="text-center">
                        {quotes.length === 0 ? (
                          <span className="text-xs text-neutral-400">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-bold text-neutral-900">{quotes.length}</span>
                            {lowest != null && (
                              <span className="text-[10px] text-green-600 font-medium">
                                {t("procurement.rfq.low", { amount: `${req.currency ?? DEFAULT_CURRENCY} ${lowest.toLocaleString()}` })}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-sm text-neutral-500">
                        {req.rfq_deadline ? formatDateShort(req.rfq_deadline) : "—"}
                      </td>
                      <td>
                        <span className={`badge ${badge.cls} inline-flex items-center gap-1`}>
                          <span className="material-symbols-outlined text-[11px]">{badge.icon}</span>
                          {t(badge.label)}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/procurement/rfq/${req.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors font-medium"
                        >
                          {t("procurement.rfq.manage")}
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination
            page={Math.min(page, lastPage)}
            lastPage={lastPage}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {showCreate && canIssueRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">{t("procurement.rfq.create")}</h2>
                <p className="text-sm text-neutral-500">{t("procurement.rfq.createHint")}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>{t("common.close")}</button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="procurement-rfq-approved-procurement-request" className="block text-xs font-semibold text-neutral-600">{t("procurement.rfq.approvedRequest")}</label>
              <select id="procurement-rfq-approved-procurement-request"
                className="form-input"
                value={selectedRequestId}
                onChange={(e) => setSelectedRequestId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">{t("procurement.rfq.selectRequest")}</option>
                {eligibleRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.reference_number} - {request.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedRequest && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.col.reference")}</p>
                  <p className="text-sm font-medium text-neutral-800">{selectedRequest.reference_number}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.col.title")}</p>
                  <p className="text-sm font-medium text-neutral-800">{selectedRequest.title}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.certificate.category")}</p>
                  <p className="text-sm font-medium text-neutral-800 capitalize">{selectedRequest.category}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.certificate.estimatedValue")}</p>
                  <p className="text-sm font-medium text-neutral-800">
                    {selectedRequest.currency ?? DEFAULT_CURRENCY} {(selectedRequest.estimated_value ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                  <p className="block text-xs font-semibold text-neutral-600">{t("procurement.rfq.supplierCategories")}</p>
                <span className="text-[11px] text-neutral-400">{t("procurement.rfq.selectCategories")}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className={`rounded-xl border p-3 text-sm ${categoryIds.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"}`}
                  >
                    <input id="procurement-rfq-setcategoryids-current-current-includes-category"
                      type="checkbox"
                      className="mr-2"
                      checked={categoryIds.includes(category.id)}
                      onChange={() =>
                        setCategoryIds((current) =>
                          current.includes(category.id)
                            ? current.filter((id) => id !== category.id)
                            : [...current, category.id]
                        )
                      }
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="procurement-rfq-deadline" className="block text-xs font-semibold text-neutral-600 mb-1">{t("procurement.col.deadline")}</label>
                <input id="procurement-rfq-deadline" type="date" className="form-input" value={rfqDeadline} onChange={(e) => setRfqDeadline(e.target.value)} />
              </div>
              <div>
                <label htmlFor="procurement-rfq-rfq-notes" className="block text-xs font-semibold text-neutral-600 mb-1">{t("procurement.rfq.notes")}</label>
                <textarea id="procurement-rfq-rfq-notes"
                  className="form-input h-[42px] resize-none"
                  placeholder={t("procurement.rfq.notesPlaceholder")}
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-neutral-700">
              {t("procurement.rfq.inviteInfo")}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-600">{t("procurement.rfq.additionalInvitees")}</p>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => setExternalInvites((current) => [...current, { name: "", email: "" }])}
                >
                  {t("procurement.rfq.addEmail")}
                </button>
              </div>

              {externalInvites.map((invite, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                  <input
                    className="form-input"
                    placeholder={t("procurement.rfq.supplierName")}
                    value={invite.name}
                    onChange={(e) =>
                      setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))
                    }
                  />
                  <input
                    className="form-input"
                    placeholder={t("procurement.rfq.emailPlaceholder")}
                    value={invite.email}
                    onChange={(e) =>
                      setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      setExternalInvites((current) =>
                        current.length === 1 ? [{ name: "", email: "" }] : current.filter((_, i) => i !== index)
                      )
                    }
                  >
                    {t("procurement.remove")}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>{t("common.cancel")}</button>
              <button
                type="button"
                className="btn-primary disabled:opacity-60"
                disabled={issueMutation.isPending || !selectedRequestId || categoryIds.length === 0}
                onClick={() => issueMutation.mutate()}
              >
                {issueMutation.isPending ? t("procurement.rfq.issuing") : t("procurement.rfq.issue")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
