"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { contractsApi, type Contract } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { CONTRACTS_HUB_CARDS } from "@/lib/hubs/contracts";
import {
  ContractStatusBadge,
  ContractSubNav,
  ContractTableWrap,
  formatContractMoney,
} from "@/components/contracts/ContractChrome";

function unwrapList(payload: unknown): Contract[] {
  const data = (payload as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Contract[]) : [];
}

function KpiCard({ label, value, icon, color, bg, href }: {
  label: string; value: number | string; icon: string; color: string; bg: string; href?: string;
}) {
  const inner = (
    <div className={`card p-5 flex items-center gap-3 ${href ? "hover:shadow-md transition-shadow" : ""}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <span className={`material-symbols-outlined text-[22px] ${color}`} aria-hidden="true">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-neutral-900 leading-tight truncate">{value}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function ContractsDashboardPage() {
  const { t } = useI18n();
  const user = getStoredUser();
  const canCreate = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.create"]));

  const { data, isLoading } = useQuery({
    queryKey: ["contracts", "dashboard"],
    queryFn: () => contractsApi.register().then((r) => r.data),
    staleTime: 30_000,
  });

  const items = unwrapList(data);
  const total = items.length;
  const active = items.filter((c) => c.status === "active" && !c.is_expired).length;
  const draft = items.filter((c) => c.status === "draft").length;
  const expiringSoon = items.filter((c) => c.is_expiring_soon).length;
  const expired = items.filter((c) => c.is_expired).length;
  const inReview = items.filter((c) => {
    const life = (c.contract_status ?? "").toUpperCase();
    return ["IN_REVIEW", "APPROVAL_PENDING", "CHANGES_REQUESTED"].includes(life);
  }).length;
  const activeItems = items.filter((c) => c.status === "active");
  const totalValue = activeItems.reduce((sum, c) => sum + Number(c.value || 0), 0);
  const currencySet = new Set(activeItems.map((c) => (c.currency || "NAD").trim() || "NAD"));
  const valueDisplay = currencySet.size <= 1
    ? formatContractMoney([...currencySet][0] || "NAD", totalValue)
    : t("contracts.kpi.mixedValue", { amount: totalValue.toLocaleString(), count: currencySet.size });

  const recent = [...items].slice(0, 6);
  const loadingMark = t("contracts.loading");

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="contracts.title"
        subtitle="contracts.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title" }]} />}
        actions={
          <>
            {canCreate && (
              <Link href="/contracts/create" className="btn-primary inline-flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
                {t("contracts.new")}
              </Link>
            )}
            <Link href="/contracts/register" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">menu_book</span>
              {t("contracts.register")}
            </Link>
          </>
        }
      />
      <ContractSubNav />
      <ModuleHubCards cards={CONTRACTS_HUB_CARDS} />

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">{t("contracts.portfolio")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label={t("contracts.kpi.total")} value={isLoading ? loadingMark : total} icon="description" color="text-primary" bg="bg-primary/10" href="/contracts/register" />
          <KpiCard label={t("contracts.kpi.active")} value={isLoading ? loadingMark : active} icon="check_circle" color="text-green-600" bg="bg-green-50" href="/contracts/register?status=active" />
          <KpiCard label={t("contracts.kpi.activeValue")} value={isLoading ? loadingMark : valueDisplay} icon="payments" color="text-blue-600" bg="bg-blue-50" />
          <KpiCard label={t("contracts.kpi.drafts")} value={isLoading ? loadingMark : draft} icon="edit_note" color="text-neutral-600" bg="bg-neutral-100" href="/contracts/register?status=draft" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">{t("contracts.riskExpiry")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KpiCard label={t("contracts.kpi.expiring")} value={isLoading ? loadingMark : expiringSoon} icon="schedule" color="text-amber-600" bg="bg-amber-50" href="/contracts/register" />
          <KpiCard label={t("contracts.kpi.expired")} value={isLoading ? loadingMark : expired} icon="event_busy" color="text-red-600" bg="bg-red-50" href="/contracts/register" />
          <KpiCard label={t("contracts.kpi.inReview")} value={isLoading ? loadingMark : inReview} icon="rate_review" color="text-orange-600" bg="bg-orange-50" href="/contracts/register?status=draft" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.recent")}</h2>
          <Link href="/contracts/register" className="text-xs text-primary whitespace-nowrap">{t("contracts.viewRegister")}</Link>
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-neutral-500">{t("contracts.loading")}</div>
        ) : recent.length === 0 ? (
          <div className="p-5 text-sm text-neutral-500">{t("contracts.emptyYet")}</div>
        ) : (
          <ContractTableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("contracts.col.reference")}</th>
                  <th>{t("contracts.col.title")}</th>
                  <th>{t("contracts.col.counterparty")}</th>
                  <th className="text-right">{t("contracts.col.value")}</th>
                  <th>{t("contracts.col.endDate")}</th>
                  <th>{t("contracts.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/contracts/${c.id}`} className="font-mono text-xs text-primary">{c.reference_number}</Link></td>
                    <td className="text-sm font-medium text-neutral-800 max-w-[220px] truncate">{c.title}</td>
                    <td className="text-sm text-neutral-600">{c.display_counterparty ?? c.vendor?.name ?? "—"}</td>
                    <td className="text-right text-sm font-semibold text-neutral-900 whitespace-nowrap">{formatContractMoney(c.currency, c.value)}</td>
                    <td className="text-sm text-neutral-500 whitespace-nowrap">{c.end_date ? formatDateShort(c.end_date) : "—"}</td>
                    <td><ContractStatusBadge status={c.contract_status ?? c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContractTableWrap>
        )}
      </div>
    </div>
  );
}
