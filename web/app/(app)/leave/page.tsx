"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { leaveApi, type LeaveRequest } from "@/lib/api";
import { canAccessRoute, getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { categorizeLeaveBalances, type LeaveBalancesPayload } from "@/lib/leaveBalances";
import { LEAVE_HUB_CARDS, type LeaveHubCard, type LeaveHubSection } from "@/lib/leaveHub";
import { LeaveBalanceStrip } from "@/components/leave/LeaveBalanceStrip";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { useToast } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import { RegisterMobileCards } from "@/components/ui/RegisterMobileCards";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  approved: { label: "leave.status.approved", cls: "badge-success" },
  submitted: { label: "leave.status.submitted", cls: "badge-warning" },
  rejected: { label: "leave.status.rejected", cls: "badge-danger" },
  draft: { label: "leave.status.draft", cls: "badge-muted" },
  cancelled: { label: "leave.status.cancelled", cls: "badge-muted" },
  withdrawn: { label: "leave.status.withdrawn", cls: "badge-muted" },
  returned_for_correction: { label: "leave.status.returned_for_correction", cls: "badge-warning" },
};

const FILTER_TABS = [
  { key: "all", label: "leave.filter.all" },
  { key: "draft", label: "leave.status.draft" },
  { key: "submitted", label: "leave.status.submitted" },
  { key: "approved", label: "leave.status.approved" },
  { key: "rejected", label: "leave.status.rejected" },
  { key: "returned_for_correction", label: "leave.status.returned_for_correction" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

const HUB_SECTIONS: { id: LeaveHubSection; title: string; description: string }[] = [
  { id: "queues", title: "leave.hub.queues.title", description: "leave.hub.queues.description" },
  { id: "views", title: "leave.hub.views.title", description: "leave.hub.views.description" },
  { id: "tools", title: "leave.hub.tools.title", description: "leave.hub.tools.description" },
];

function FeatureCard({ card }: { card: LeaveHubCard }) {
  const { t } = useI18n();
  return (
    <Link
      href={card.href}
      className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="material-symbols-outlined mt-0.5 text-primary">{card.icon}</span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900">{t(card.title)}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{t(card.purpose)}</span>
      </span>
    </Link>
  );
}

function unwrapList(payload: unknown): LeaveRequest[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as LeaveRequest[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: LeaveRequest[] }).data;
  }
  return [];
}

export default function LeavePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      }
    >
      <LeavePageInner />
    </Suspense>
  );
}

function LeavePageInner() {
  const { t } = useI18n();
  const typeLabel = (code: string) => {
    const key = `leave.type.${code}`;
    const label = t(key);
    return label === key ? code : label;
  };
  const searchParams = useSearchParams();
  const queue = searchParams.get("queue") || undefined;
  const user = getStoredUser();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");


  const {
    data: requests = [],
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["leave", "list", queue],
    queryFn: () =>
      leaveApi
        .list({ per_page: 100, ...(queue ? { queue } : {}) })
        .then((res) => unwrapList(res.data)),
    staleTime: 30_000,
  });

  const { data: balances = null, isLoading: balancesLoading } = useQuery({
    queryKey: ["leave", "balances"],
    queryFn: () => leaveApi.getBalances().then((res) => res.data as LeaveBalancesPayload),
    staleTime: 5 * 60_000,
  });

  const visibleCards = useMemo(
    () => LEAVE_HUB_CARDS.filter((card) => canAccessRoute(user, card.href)),
    [user],
  );

  const balanceCards = useMemo(() => categorizeLeaveBalances(balances), [balances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.reason,
        row.leave_type,
        row.status,
        row.requester?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, filter, search]);

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(() => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE), [filtered, page, lastPage]);

  const getId = useCallback((row: LeaveRequest) => row.id, []);
  const canSelectDraft = useCallback((row: LeaveRequest) => row.status === "draft", []);
  const selection = useRowSelection({
    rows: filter === "draft" ? filtered : filtered.filter((r) => r.status === "draft"),
    getId,
    canSelect: canSelectDraft,
  });

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `leave-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        type: r.leave_type,
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
        days: r.days_requested,
        reason: r.reason ?? "",
        requester: r.requester?.name ?? "",
      })),
      [
        { key: "reference", header: t("leave.col.reference") },
        { key: "type", header: t("leave.col.type") },
        { key: "status", header: t("leave.col.status") },
        { key: "start_date", header: t("leave.col.start") },
        { key: "end_date", header: t("leave.col.end") },
        { key: "days", header: t("leave.col.days") },
        { key: "reason", header: t("leave.col.reason") },
        { key: "requester", header: t("leave.col.requester") },
      ],
    );
  };

  const handleDelete = async (row: LeaveRequest) => {
    if (
      !(await confirm({
        title: t("leave.list.deleteDraftTitle"),
        message: t("leave.list.deleteDraftMsg", { ref: row.reference_number }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    setActionError(null);
    try {
      await leaveApi.delete(row.id);
      success(t("leave.list.draftDeleted"));
      selection.clear();
      await queryClient.invalidateQueries({ queryKey: ["leave", "list"] });
    } catch {
      setActionError(t("leave.list.deleteFailed"));
    } finally {
      setActionId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    if (
      !(await confirm({
        title: t("leave.list.deleteDraftsTitle"),
        message: t("leave.list.deleteDraftsMsg", { count: ids.length }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setBulkLoading(true);
    setActionError(null);
    try {
      await Promise.all(ids.map((id) => leaveApi.delete(id)));
      selection.clear();
      success(t("leave.list.draftsDeleted"));
      await queryClient.invalidateQueries({ queryKey: ["leave", "list"] });
    } catch {
      setActionError(t("leave.list.someDeleteFailed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleWithdraw = async (row: LeaveRequest) => {
    if (
      !(await confirm({
        title: t("leave.list.withdrawTitle"),
        message: t("leave.list.withdrawMsg", { ref: row.reference_number }),
        confirmText: t("leave.list.withdraw"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    setActionError(null);
    try {
      await leaveApi.withdraw(row.id);
      success(t("leave.list.withdrawn"));
      await queryClient.invalidateQueries({ queryKey: ["leave", "list"] });
    } catch {
      setActionError(t("leave.list.withdrawFailed"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <RegisterShell
      title={queue === "recommend" ? t("leave.list.recommendTitle") : t("nav.leave")}
        subtitle={
          queue === "recommend"
            ? t("leave.list.recommendSubtitle")
            : t("leave.list.subtitle")
        }
      breadcrumbs={
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <span className="text-neutral-700">{t("nav.leave")}</span>
        </div>
      }
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, lastPage)}
      pageCount={lastPage}
      total={filtered.length}
      onPageChange={setPage}
      loading={loading}
      actions={
        <div className="flex flex-wrap gap-2">
          <PrintButton className="text-xs no-print" />
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("leave.common.exportCsv")}
          </button>
          <Link href="/leave/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("leave.list.newRequest")}
          </Link>
        </div>
      }
      stats={
        <>
{(isError || actionError) && (
            <ErrorBanner
              message={actionError ?? t("leave.list.loadError")}
              onRetry={isError ? () => void refetch() : undefined}
              onDismiss={isError ? undefined : () => setActionError(null)}
            />
          )}
          <LeaveBalanceStrip cards={balanceCards} loading={balancesLoading} year={balances?.period_year} />
          {queue !== "recommend" && visibleCards.length > 0 && (
            <div className="space-y-4">
              {HUB_SECTIONS.map((section) => {
                const cards = visibleCards.filter((card) => card.section === section.id);
                if (cards.length === 0) return null;
                return (
                  <FormSection key={section.id} title={t(section.title)} description={t(section.description)} dense>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {cards.map((card) => (
                        <FeatureCard key={`${card.section}-${card.href}-${card.title}`} card={card} />
                      ))}
                    </div>
                  </FormSection>
                );
              })}
            </div>
          )}
        </>
      }
      filters={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Input
                type="search"
                icon="search"
                className="bg-white"
                placeholder={t("leave.list.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label={t("leave.list.searchAria")}
              />
            </div>
            <Select
              className="w-full sm:w-44 sm:hidden"
              aria-label={t("leave.list.filterAria")}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as FilterKey);
                selection.clear();
                setPage(1);
              }}
              options={FILTER_TABS.map((tab) => ({ value: tab.key, label: t(tab.label) }))}
            />
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setFilter(tab.key);
                  selection.clear();
                  setPage(1);
                }}
                className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
      }
      bulkBar={
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear} disabled={bulkLoading}>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void handleBulkDelete()}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            {bulkLoading ? t("leave.list.deleting") : t("leave.list.deleteSelected")}
          </button>
        </BulkSelectionBar>
      }
      empty={
        !loading && filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="event_available"
              title={t("leave.list.empty")}
              description={
                filter === "all" && !search
                  ? t("leave.list.emptyFirst")
                  : t("leave.list.emptyFiltered")
              }
              action={
                <Link href="/leave/create" className="btn-primary inline-flex text-sm">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {t("leave.hub.apply.title")}
                </Link>
              }
            />
          </div>
        ) : undefined
      }
    >
      <div className="card overflow-hidden">
          <RegisterMobileCards
            items={paged}
            getKey={(req) => req.id}
            title={(req) => req.reference_number}
            subtitle={(req) => typeLabel(req.leave_type)}
            badge={(req) => {
              const s = STATUS_CONFIG[req.status] ?? { label: req.status, cls: "badge-muted" };
              const variant =
                s.cls.includes("success") ? "success" :
                s.cls.includes("warning") ? "warning" :
                s.cls.includes("danger") ? "danger" : "muted";
              return <Badge variant={variant}>{t(s.label)}</Badge>;
            }}
            fields={(req) => [
              { label: t("leave.col.dates"), value: `${formatDateShort(req.start_date)} → ${formatDateShort(req.end_date)}` },
              { label: t("leave.col.days"), value: req.days_requested },
              { label: t("leave.col.reason"), value: req.reason || "—" },
            ]}
            actions={(req) => (
              <Link href={`/leave/${req.id}`} className="btn-secondary text-xs py-1 px-2">
                {t("leave.list.view")}
              </Link>
            )}
          />
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table w-full">
              <caption className="sr-only">{t("leave.list.caption")}</caption>
              <thead>
                <tr>
                  <th className={selectionColumnClass.th}>
                    <SelectAllCheckbox
                      checked={selection.allSelectableSelected}
                      indeterminate={
                        selection.someSelectableSelected && !selection.allSelectableSelected
                      }
                      onChange={selection.toggleAllSelectable}
                      disabled={selection.selectableIds.length === 0 || bulkLoading}
                      label={t("leave.list.selectAllDrafts")}
                    />
                  </th>
                  <th>{t("leave.col.reference")}</th>
                  <th>{t("leave.col.type")}</th>
                  <th>{t("leave.col.dates")}</th>
                  <th>{t("leave.col.days")}</th>
                  <th>{t("leave.col.reason")}</th>
                  <th>{t("leave.col.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((req) => {
                  const s = STATUS_CONFIG[req.status] ?? { label: req.status, cls: "badge-muted" };
                  const busy = actionId === req.id;
                  const canDelete = req.status === "draft";
                  return (
                    <tr key={req.id} className={selection.isSelected(req.id) ? "bg-primary/5" : undefined}>
                      <td className={selectionColumnClass.td}>
                        <RowCheckbox
                          checked={selection.isSelected(req.id)}
                          onChange={() => selection.toggle(req.id)}
                          disabled={!canDelete || bulkLoading}
                          title={canDelete ? undefined : t("leave.list.onlyDrafts")}
                          label={t("leave.list.selectRow", { ref: req.reference_number })}
                        />
                      </td>
                      <td className="font-mono text-xs text-neutral-600">{req.reference_number}</td>
                      <td className="text-sm">{typeLabel(req.leave_type)}</td>
                      <td className="whitespace-nowrap text-xs text-neutral-600">
                        {formatDateShort(req.start_date)} → {formatDateShort(req.end_date)}
                      </td>
                      <td>{req.days_requested}</td>
                      <td className="max-w-[220px] truncate text-sm text-neutral-700">
                        {req.reason || "—"}
                      </td>
                      <td>
                        {(() => {
                          const variant =
                            s.cls.includes("success") ? "success" :
                            s.cls.includes("warning") ? "warning" :
                            s.cls.includes("danger") ? "danger" : "muted";
                          return <Badge variant={variant as "success" | "warning" | "danger" | "muted"}>{t(s.label)}</Badge>;
                        })()}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/leave/${req.id}`} className="btn-secondary text-xs py-1 px-2">
                            {t("leave.list.view")}
                          </Link>
                          {canDelete && (
                            <>
                              <Link
                                href={`/leave/create?edit=${req.id}`}
                                className="btn-secondary text-xs py-1 px-2"
                              >
                                {t("common.edit")}
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleDelete(req)}
                                className="btn-secondary text-xs py-1 px-2 text-red-600 disabled:opacity-50"
                              >
                                {t("common.delete")}
                              </button>
                            </>
                          )}
                          {(req.status === "submitted" || req.status === "returned_for_correction") && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleWithdraw(req)}
                              className="btn-secondary text-xs py-1 px-2 text-amber-700 disabled:opacity-50"
                            >
                              {t("leave.list.withdraw")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </div>
    </RegisterShell>
  );
}
