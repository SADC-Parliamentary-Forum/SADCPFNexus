"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { contractsApi, type Contract } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  ContractStatusBadge,
  ContractSubNav,
  ContractTableWrap,
  formatContractMoney,
} from "@/components/contracts/ContractChrome";

const FILTERS = ["all", "draft", "active", "completed", "terminated"] as const;
const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

function unwrapList(payload: unknown): Contract[] {
  const data = (payload as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Contract[]) : [];
}

function ContractRegisterInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const user = getStoredUser();
  const canCreate = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.create"]));

  const initialStatus = FILTERS.includes(searchParams.get("status") as (typeof FILTERS)[number])
    ? (searchParams.get("status") as (typeof FILTERS)[number])
    : "all";

  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>(initialStatus);
  const [search, setSearch] = useState("");

  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacyText, setLegacyText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [legacyDisclaimer, setLegacyDisclaimer] = useState<string | null>(null);
  const [legacy, setLegacy] = useState({
    title: "", counterparty_name: "", value: "", currency: DEFAULT_CURRENCY,
    start_date: "", end_date: "", signed_at: "", legacy_status: "active",
  });

  useEffect(() => {
    if (searchParams.get("new") && canCreate) {
      router.replace("/contracts/create");
      return;
    }
    const request = searchParams.get("request");
    if (request && canCreate) {
      router.replace(`/contracts/create?request=${encodeURIComponent(request)}`);
    }
  }, [searchParams, router, canCreate]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contracts", "register", statusFilter],
    queryFn: () =>
      contractsApi.register(statusFilter !== "all" ? { status: statusFilter } : undefined).then((r) => r.data),
    staleTime: 30_000,
  });

  const allItems = unwrapList(data);
  const items = search.trim()
    ? allItems.filter((c) =>
        `${c.reference_number} ${c.title} ${c.vendor?.name ?? ""} ${c.display_counterparty ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    : allItems;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="contracts.registerTitle"
        subtitle="contracts.registerSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title", href: "/contracts" }, { label: "contracts.register" }]} />}
        actions={
          <>
            {canCreate && (
              <Link href="/contracts/create" className="btn-primary inline-flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
                {t("contracts.new")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => { setLegacyOpen(true); setLegacyText(""); setLegacyDisclaimer(null); }}
              className="btn-secondary inline-flex items-center gap-1.5 text-sm"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">auto_awesome</span>
              {t("contracts.importLegacy")}
            </button>
          </>
        }
      />
      <ContractSubNav />

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label={t("contracts.col.status")}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`filter-tab ${statusFilter === f ? "active" : ""}`}
            >
              {f === "all" ? t("contracts.filter.all") : t(`contracts.status.${f}`)}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("contracts.search")}
          className="form-input max-w-xs text-sm"
          aria-label={t("contracts.search")}
        />
      </div>

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
      ) : isError ? (
        <div className="card p-6 text-center text-sm text-red-600">{t("contracts.loadError")}</div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="description" title={t("contracts.empty")} description={t("contracts.emptyHint")} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ContractTableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("contracts.col.reference")}</th>
                  <th>{t("contracts.col.title")}</th>
                  <th>{t("contracts.col.type")}</th>
                  <th>{t("contracts.col.counterparty")}</th>
                  <th className="text-right">{t("contracts.col.value")}</th>
                  <th>{t("contracts.col.endDate")}</th>
                  <th>{t("contracts.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="font-mono text-xs text-primary">{c.reference_number}</Link>
                      {c.is_legacy && (
                        <span className="ml-1.5 text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full">{t("contracts.legacy")}</span>
                      )}
                    </td>
                    <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{c.title}</td>
                    <td className="text-xs text-neutral-500">{c.type?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{c.display_counterparty ?? c.vendor?.name ?? "—"}</td>
                    <td className="text-right font-semibold text-neutral-900 text-sm whitespace-nowrap">{formatContractMoney(c.currency, c.value)}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-neutral-500 whitespace-nowrap">{c.end_date ? formatDateShort(c.end_date) : "—"}</span>
                        {c.is_expired && (<span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{t("contracts.status.expired")}</span>)}
                        {!c.is_expired && c.is_expiring_soon && (<span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{t("contracts.soon")}</span>)}
                      </div>
                    </td>
                    <td>
                      <ContractStatusBadge status={c.contract_status ?? c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContractTableWrap>
        </div>
      )}

      {legacyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setLegacyOpen(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="legacy-import-title">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
                <span className="material-symbols-outlined text-[20px] text-purple-600" aria-hidden="true">auto_awesome</span>
              </div>
              <h2 id="legacy-import-title" className="text-base font-bold text-neutral-900">{t("contracts.importLegacyTitle")}</h2>
            </div>
            <p className="text-xs text-neutral-500">{t("contracts.importLegacyHint")}</p>
            <textarea className="form-input h-32 resize-none font-mono text-xs w-full" value={legacyText} onChange={(e) => setLegacyText(e.target.value)} />
            <div>
              <button
                type="button"
                className="btn-secondary text-sm disabled:opacity-60"
                disabled={!legacyText.trim() || extracting}
                onClick={() => {
                  setExtracting(true);
                  contractsApi.extract(legacyText.trim()).then((r) => {
                    const s = r.data.data.suggestions;
                    setLegacyDisclaimer(r.data.data.disclaimer);
                    setLegacy((prev) => ({
                      ...prev,
                      counterparty_name: (s.counterparty_name?.value as string) ?? prev.counterparty_name,
                      value: s.value ? String(s.value.value) : prev.value,
                      currency: (s.currency?.value as string) ?? prev.currency,
                      start_date: (s.start_date?.value as string) ?? prev.start_date,
                      end_date: (s.end_date?.value as string) ?? prev.end_date,
                      signed_at: (s.signed_at?.value as string) ?? prev.signed_at,
                      title: prev.title || ((s.type_hint?.value as string) ? `${s.type_hint!.value} — ${s.counterparty_name?.value ?? ""}`.trim() : prev.title),
                    }));
                  }).catch(() => toast.error(t("contracts.extractFailed"))).finally(() => setExtracting(false));
                }}
              >
                {extracting ? t("contracts.extracting") : t("contracts.extractAi")}
              </button>
            </div>
            {legacyDisclaimer && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{legacyDisclaimer}</div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.field.title")} <span className="text-red-500">*</span></label>
                <input className="form-input w-full" value={legacy.title} onChange={(e) => setLegacy({ ...legacy, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.col.counterparty")}</label>
                <input className="form-input w-full" value={legacy.counterparty_name} onChange={(e) => setLegacy({ ...legacy, counterparty_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">{t("contracts.col.value")}</label>
                  <input type="number" className="form-input w-full" value={legacy.value} onChange={(e) => setLegacy({ ...legacy, value: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">{t("contracts.settings.currencies")}</label>
                  <input className="form-input w-full" value={legacy.currency} maxLength={3} onChange={(e) => setLegacy({ ...legacy, currency: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.overview.start")}</label>
                <input type="date" className="form-input w-full" value={legacy.start_date} onChange={(e) => setLegacy({ ...legacy, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.overview.end")}</label>
                <input type="date" className="form-input w-full" value={legacy.end_date} onChange={(e) => setLegacy({ ...legacy, end_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.overview.signature")}</label>
                <input type="date" className="form-input w-full" value={legacy.signed_at} onChange={(e) => setLegacy({ ...legacy, signed_at: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.col.status")}</label>
                <select className="form-input w-full" value={legacy.legacy_status} onChange={(e) => setLegacy({ ...legacy, legacy_status: e.target.value })}>
                  <option value="active">{t("contracts.status.active")}</option>
                  <option value="completed">{t("contracts.status.completed")}</option>
                  <option value="terminated">{t("contracts.status.terminated")}</option>
                  <option value="expired">{t("contracts.status.expired")}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setLegacyOpen(false)}>{t("common.cancel")}</button>
              <button
                type="button"
                className="btn-primary flex-1 disabled:opacity-60"
                disabled={!legacy.title.trim() || !legacy.counterparty_name.trim() || !legacy.value || !legacy.start_date || !legacy.end_date}
                onClick={() => {
                  contractsApi.importLegacy({
                    title: legacy.title.trim(), counterparty_name: legacy.counterparty_name.trim(), value: Number(legacy.value),
                    currency: legacy.currency, start_date: legacy.start_date, end_date: legacy.end_date,
                    signed_at: legacy.signed_at || undefined, legacy_status: legacy.legacy_status,
                  }).then((res) => { queryClient.invalidateQueries({ queryKey: ["contracts"] }); setLegacyOpen(false); router.push(`/contracts/${res.data.data.id}`); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.importFailed")));
                }}
              >
                {t("contracts.importContract")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContractRegisterPage() {
  return (
    <Suspense fallback={null}>
      <ContractRegisterInner />
    </Suspense>
  );
}
