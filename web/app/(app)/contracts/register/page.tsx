"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractsApi, vendorsApi, procurementApi, type Contract, type Vendor } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "status.draft",      cls: "badge-muted",   icon: "edit_note"    },
  active:     { label: "contracts.status.active",     cls: "badge-success", icon: "check_circle" },
  completed:  { label: "contracts.status.completed",  cls: "badge-primary", icon: "task_alt"     },
  terminated: { label: "contracts.status.terminated", cls: "badge-danger",  icon: "cancel"       },
};

const FILTERS = ["all", "draft", "active", "completed", "terminated"];
const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

function unwrapList(payload: unknown): Contract[] {
  const data = (payload as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Contract[]) : [];
}

function ContractRegisterInner() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const toast        = useToast();
  const { t }        = useI18n();
  const searchParams = useSearchParams();
  const requestParam = searchParams.get("request");

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]             = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  // AI-assisted legacy import
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacyText, setLegacyText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [legacyDisclaimer, setLegacyDisclaimer] = useState<string | null>(null);
  const [legacy, setLegacy] = useState({ title: "", counterparty_name: "", value: "", currency: DEFAULT_CURRENCY, start_date: "", end_date: "", signed_at: "", legacy_status: "active" });

  const [title, setTitle]               = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<number | "">("");
  const [selectedRequestId, setSelectedRequestId] = useState<number | "">(requestParam ? Number(requestParam) : "");
  const [startDate, setStartDate]       = useState("");
  const [endDate, setEndDate]           = useState("");
  const [value, setValue]               = useState("");
  const [currency, setCurrency]         = useState(DEFAULT_CURRENCY);
  const [description, setDescription]   = useState("");

  useEffect(() => {
    if (requestParam || searchParams.get("new")) setShowModal(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contracts", "register", statusFilter],
    queryFn: () =>
      contractsApi.register(statusFilter !== "all" ? { status: statusFilter } : undefined).then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: vendorData } = useQuery({
    queryKey: ["vendors-approved"],
    queryFn: () => vendorsApi.list({ status: "approved", per_page: 100 }).then((r) => r.data),
    enabled: showModal,
  });
  const availableVendors: Vendor[] = (vendorData as { data?: Vendor[] })?.data ?? [];

  const { data: requestData } = useQuery({
    queryKey: ["procurement-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
    enabled: showModal,
  });
  type RequestOption = { id: number; reference_number: string; title: string };
  const awardedRequests: RequestOption[] = ((requestData as { data?: RequestOption[] })?.data ?? []);

  const openModal = () => {
    setTitle(""); setSelectedVendorId(""); setSelectedRequestId("");
    setStartDate(""); setEndDate(""); setValue(""); setCurrency(DEFAULT_CURRENCY);
    setDescription(""); setSubmitError(null); setShowModal(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      contractsApi.create({
        vendor_id: Number(selectedVendorId),
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        value: Number(value),
        currency,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(selectedRequestId ? { procurement_request_id: Number(selectedRequestId) } : {}),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setShowModal(false);
      router.push(`/contracts/${res.data.data.id}`);
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.register.createFailed")
      );
    },
  });

  const canSubmit = !!title.trim() && !!selectedVendorId && !!startDate && !!endDate && !!value && Number(value) > 0;

  const allItems = unwrapList(data);
  const items = search.trim()
    ? allItems.filter((c) =>
        `${c.reference_number} ${c.title} ${c.vendor?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    : allItems;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
          title="contracts.register.title"
          subtitle="contracts.register.subtitle"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.dashboard.register" }]} />}
        />
        <div className="flex items-center gap-2">
          <button onClick={openModal} className="btn-primary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">add</span>
            {t("contracts.newContract")}
          </button>
          <button onClick={() => { setLegacyOpen(true); setLegacyText(""); setLegacyDisclaimer(null); }} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            {t("contracts.register.importLegacy")}
          </button>
          <Link href="/contracts" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            {t("nav.dashboard")}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}>
              {t(`contracts.register.filter.${f}`)}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("contracts.register.searchPlaceholder")}
          className="form-input max-w-xs text-sm"
          aria-label={t("contracts.register.searchLabel")}
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
        <div className="card p-6 text-center text-sm text-red-600">{t("contracts.register.loadFailed")}</div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="description" title="contracts.register.empty" description="contracts.register.emptyHint" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("contracts.register.contractReference")}</th>
                <th>{t("contracts.field.title")}</th>
                <th>{t("contracts.field.type")}</th>
                <th>{t("contracts.field.counterparty")}</th>
                <th className="text-right">{t("contracts.field.value")}</th>
                <th>{t("contracts.field.endDate")}</th>
                <th>{t("contracts.field.status")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const s = statusConfig[c.status] ?? statusConfig.draft;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="font-mono text-xs text-primary">{c.reference_number}</Link>
                      {c.is_legacy && (<span className="ml-1.5 text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full">{t("contracts.register.legacy")}</span>)}
                    </td>
                    <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{c.title}</td>
                    <td className="text-xs text-neutral-500">{c.type?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{c.display_counterparty ?? c.vendor?.name ?? "—"}</td>
                    <td className="text-right font-semibold text-neutral-900 text-sm">{c.currency} {Number(c.value).toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-neutral-500">{c.end_date ? formatDateShort(c.end_date) : "—"}</span>
                        {c.is_expired && (<span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{t("contracts.status.expired")}</span>)}
                        {!c.is_expired && c.is_expiring_soon && (<span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{t("contracts.register.soon")}</span>)}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{s.icon}</span>
                        {t(s.label)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {legacyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setLegacyOpen(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
                <span className="material-symbols-outlined text-[20px] text-purple-600">auto_awesome</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">{t("contracts.register.legacyTitle")}</h2>
            </div>
            <p className="text-xs text-neutral-500">{t("contracts.register.legacyHint")}</p>
            <textarea className="form-input h-32 resize-none font-mono text-xs" placeholder={t("contracts.register.legacyPlaceholder")} value={legacyText} onChange={(e) => setLegacyText(e.target.value)} />
            <div>
              <button className="btn-secondary text-sm disabled:opacity-60" disabled={!legacyText.trim() || extracting} onClick={() => {
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
                }).catch(() => toast.error(t("contracts.register.extractionFailed"))).finally(() => setExtracting(false));
              }}>{extracting ? t("contracts.register.extracting") : t("contracts.register.extractAi")}</button>
            </div>
            {legacyDisclaimer && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ {legacyDisclaimer}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><label htmlFor="contracts-register-legacy-title" className="text-xs font-semibold text-neutral-600">{t("contracts.field.title")} <span className="text-red-500">*</span></label><input id="contracts-register-legacy-title" className="form-input" value={legacy.title} onChange={(e) => setLegacy({ ...legacy, title: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="contracts-register-legacy-counterparty" className="text-xs font-semibold text-neutral-600">{t("contracts.register.counterpartyName")}</label><input id="contracts-register-legacy-counterparty" className="form-input" value={legacy.counterparty_name} onChange={(e) => setLegacy({ ...legacy, counterparty_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label htmlFor="contracts-register-legacy-value" className="text-xs font-semibold text-neutral-600">{t("contracts.field.value")}</label><input id="contracts-register-legacy-value" type="number" className="form-input" value={legacy.value} onChange={(e) => setLegacy({ ...legacy, value: e.target.value })} /></div>
                <div className="space-y-1"><label htmlFor="contracts-register-legacy-currency" className="text-xs font-semibold text-neutral-600">{t("contracts.field.currency")}</label><input id="contracts-register-legacy-currency" className="form-input" value={legacy.currency} maxLength={3} onChange={(e) => setLegacy({ ...legacy, currency: e.target.value.toUpperCase() })} /></div>
              </div>
              <div className="space-y-1"><label htmlFor="contracts-register-legacy-start-date" className="text-xs font-semibold text-neutral-600">{t("common.startDate")}</label><input id="contracts-register-legacy-start-date" type="date" className="form-input" value={legacy.start_date} onChange={(e) => setLegacy({ ...legacy, start_date: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="contracts-register-legacy-end-date" className="text-xs font-semibold text-neutral-600">{t("common.endDate")}</label><input id="contracts-register-legacy-end-date" type="date" className="form-input" value={legacy.end_date} onChange={(e) => setLegacy({ ...legacy, end_date: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="contracts-register-legacy-signed-date" className="text-xs font-semibold text-neutral-600">{t("contracts.register.signedDate")}</label><input id="contracts-register-legacy-signed-date" type="date" className="form-input" value={legacy.signed_at} onChange={(e) => setLegacy({ ...legacy, signed_at: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="contracts-register-legacy-status" className="text-xs font-semibold text-neutral-600">{t("contracts.field.status")}</label>
                <select id="contracts-register-legacy-status" className="form-input" value={legacy.legacy_status} onChange={(e) => setLegacy({ ...legacy, legacy_status: e.target.value })}>
                  <option value="active">{t("contracts.status.active")}</option><option value="completed">{t("contracts.status.completed")}</option><option value="terminated">{t("contracts.status.terminated")}</option><option value="expired">{t("contracts.status.expired")}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setLegacyOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1 disabled:opacity-60"
                disabled={!legacy.title.trim() || !legacy.counterparty_name.trim() || !legacy.value || !legacy.start_date || !legacy.end_date}
                onClick={() => {
                  contractsApi.importLegacy({
                    title: legacy.title.trim(), counterparty_name: legacy.counterparty_name.trim(), value: Number(legacy.value),
                    currency: legacy.currency, start_date: legacy.start_date, end_date: legacy.end_date,
                    signed_at: legacy.signed_at || undefined, legacy_status: legacy.legacy_status,
                  }).then((res) => { queryClient.invalidateQueries({ queryKey: ["contracts"] }); setLegacyOpen(false); router.push(`/contracts/${res.data.data.id}`); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.register.importFailed")));
                }}>{t("contracts.register.importContract")}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <span className="material-symbols-outlined text-[20px] text-blue-600">description</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">{t("contracts.newContract")}</h2>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="contract-title" className="text-xs font-semibold text-neutral-600">{t("contracts.register.contractTitle")} <span className="text-red-500">*</span></label>
                <input id="contract-title" type="text" className="form-input" placeholder={t("contracts.register.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label htmlFor="contract-vendor" className="text-xs font-semibold text-neutral-600">{t("contracts.field.counterparty")} <span className="text-red-500">*</span></label>
                <select id="contract-vendor" className="form-input" value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">{t("contracts.register.selectCounterparty")}</option>
                  {availableVendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
                {availableVendors.length === 0 && (
                  <p className="text-xs text-amber-600">{t("contracts.register.noSuppliers")} <Link href="/procurement/vendors" className="btn-secondary text-xs py-0.5 px-2 inline-flex">{t("contracts.register.addSupplier")}</Link> {t("contracts.register.first")}</p>
                )}
              </div>

              {awardedRequests.length > 0 && (
                <div className="space-y-1">
                  <label htmlFor="contract-request" className="text-xs font-semibold text-neutral-600">{t("contracts.register.linkedAward")}</label>
                  <select id="contract-request" className="form-input" value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">{t("contracts.register.none")}</option>
                    {awardedRequests.map((r) => (<option key={r.id} value={r.id}>{r.reference_number} — {r.title}</option>))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="contract-start" className="text-xs font-semibold text-neutral-600">{t("contracts.field.startDate")} <span className="text-red-500">*</span></label>
                  <input id="contract-start" type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="contract-end" className="text-xs font-semibold text-neutral-600">{t("contracts.field.endDate")} <span className="text-red-500">*</span></label>
                  <input id="contract-end" type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="contract-value" className="text-xs font-semibold text-neutral-600">{t("contracts.register.contractValue")} <span className="text-red-500">*</span></label>
                  <input id="contract-value" type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="contract-currency" className="text-xs font-semibold text-neutral-600">{t("contracts.field.currency")}</label>
                  <input id="contract-currency" type="text" className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="contract-description" className="text-xs font-semibold text-neutral-600">{t("contracts.templates.descriptionOptional")}</label>
                <textarea id="contract-description" className="form-input resize-none h-20" placeholder={t("contracts.register.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1 disabled:opacity-60" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">description</span>
                )}
                {createMutation.isPending ? t("contracts.register.creating") : t("contracts.register.createContract")}
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
