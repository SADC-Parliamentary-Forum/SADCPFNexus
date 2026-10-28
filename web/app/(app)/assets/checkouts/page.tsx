"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { assetLifecycleApi, assetsApi, type Asset, type TenantUserOption } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { SearchField } from "@/components/ui/SearchField";
import { AssetPicker } from "@/components/assets/AssetPicker";
import { AssetAssigneePicker } from "@/components/assets/AssetAssigneePicker";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Checkout = {
  id: number;
  purpose?: string | null;
  checked_out_at?: string | null;
  expected_return_at?: string | null;
  returned_at?: string | null;
  damage_reported?: boolean;
  asset?: { id: number; tag_number?: string; asset_code?: string; name?: string };
  borrower?: { id: number; name?: string; email?: string };
};

type Filter = "open" | "overdue" | "returned" | "all";
const FILTERS: Filter[] = ["open", "overdue", "returned", "all"];
const CONDITIONS = ["good", "fair", "poor", "damaged"] as const;

function canManageCheckouts(): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["assets.checkout.manage", "assets.admin", "assets.manage"]);
}

function isOverdue(row: Checkout): boolean {
  return !row.returned_at && !!row.expected_return_at && new Date(row.expected_return_at).getTime() < Date.now();
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function daysLate(value: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

export default function AssetCheckoutsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [canManage, setCanManage] = useState(false);

  // New checkout
  const [newOpen, setNewOpen] = useState(false);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [borrower, setBorrower] = useState<TenantUserOption | null>(null);
  const [expectedReturn, setExpectedReturn] = useState("");
  const [purpose, setPurpose] = useState("");
  const [conditionOut, setConditionOut] = useState<string>("good");

  // Return
  const [returning, setReturning] = useState<Checkout | null>(null);
  const [conditionIn, setConditionIn] = useState<string>("good");
  const [damage, setDamage] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => setCanManage(canManageCheckouts()), []);

  useEffect(() => {
    let cancelled = false;
    const term = search.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await assetLifecycleApi.checkouts({ status: filter, search: term || undefined, per_page: 100 });
        const payload = r.data as unknown as { data?: Checkout[] } | Checkout[];
        if (!cancelled) setRows(Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError(t("assets.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, term ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filter, search, reload, t]);

  function resetNew() {
    setAsset(null);
    setBorrower(null);
    setExpectedReturn("");
    setPurpose("");
    setConditionOut("good");
  }

  async function submitCheckout(e: FormEvent) {
    e.preventDefault();
    if (!asset || !borrower) return;
    setBusy(true);
    setError("");
    try {
      await assetsApi.checkout(asset.id, {
        borrower_id: borrower.id,
        purpose: purpose.trim() || undefined,
        expected_return_at: expectedReturn || undefined,
        condition_out: conditionOut,
      });
      setNotice(t("assets.checkout.created", { asset: asset.tag_number || asset.name, name: borrower.name }));
      setNewOpen(false);
      resetNew();
      setReload((n) => n + 1);
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.mine.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn(e: FormEvent) {
    e.preventDefault();
    if (!returning?.asset?.id) return;
    setBusy(true);
    setError("");
    try {
      await assetsApi.returnCheckout(returning.asset.id, {
        condition_in: conditionIn,
        damage_reported: damage,
        notes: returnNotes.trim() || undefined,
      });
      setNotice(t("assets.checkout.returned", { asset: returning.asset.tag_number || returning.asset.name || "" }));
      setReturning(null);
      setReload((n) => n + 1);
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.mine.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.checkout.title"
        subtitle="assets.checkout.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets", label: "nav.assets" }, { label: "assets.checkout.title" }]} />}
        actions={canManage ? (
          <button type="button" className="btn-primary" onClick={() => { setError(""); setNewOpen(true); }} data-testid="checkout-new">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            {t("assets.checkout.new")}
          </button>
        ) : undefined}
      />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1" role="tablist" aria-label={t("assets.checkout.title")}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              data-testid={`checkout-filter-${f}`}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === f ? "bg-white font-medium text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
            >
              {t(`assets.checkout.filter.${f}`)}
            </button>
          ))}
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("assets.checkout.search")}
          testId="checkout-search"
          className="w-full sm:w-80"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("assets.picker.asset")}</th>
              <th>{t("assets.checkout.borrower")}</th>
              <th>{t("assets.checkout.purpose")}</th>
              <th>{t("assets.checkout.checkedOut")}</th>
              <th>{t("assets.checkout.expectedReturn")}</th>
              <th>{t("assets.view.fieldStatus")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdue = isOverdue(row);
              return (
                <tr key={row.id} data-testid={`checkout-row-${row.id}`}>
                  <td>
                    {row.asset?.id ? (
                      <Link href={`/assets/${row.asset.id}`} className="text-primary">
                        <span className="font-mono text-xs">{row.asset.tag_number || row.asset.asset_code}</span>{" "}
                        {row.asset.name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td>{row.borrower?.name ?? "—"}</td>
                  <td className="max-w-[16rem] truncate">{row.purpose || "—"}</td>
                  <td>{formatDate(row.checked_out_at)}</td>
                  <td>{formatDate(row.expected_return_at)}</td>
                  <td>
                    {row.returned_at ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                        {t("assets.checkout.returnedOn", { date: formatDate(row.returned_at) })}
                      </span>
                    ) : overdue ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        {t("assets.checkout.overdueBy", { days: daysLate(row.expected_return_at as string) })}
                      </span>
                    ) : (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">{t("assets.checkout.onLoan")}</span>
                    )}
                  </td>
                  <td className="text-right">
                    {canManage && row.asset?.id && !row.returned_at ? (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        data-testid={`checkout-return-${row.id}`}
                        onClick={() => {
                          setReturning(row);
                          setConditionIn("good");
                          setDamage(false);
                          setReturnNotes("");
                        }}
                      >
                        {t("assets.checkout.return")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 ? (
              <TableEmpty colSpan={7} title={search.trim() ? t("common.noResults") : t(`assets.checkout.empty.${filter}`)} />
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title={t("assets.checkout.new")}
        description={t("assets.checkout.newHint")}
        size="lg"
      >
        <form className="space-y-4" onSubmit={submitCheckout} data-testid="checkout-form">
          <AssetPicker
            id="checkout-asset"
            label={t("assets.picker.asset")}
            value={asset}
            onSelect={setAsset}
            status="available"
            required
            hint={t("assets.ops.availableOnly")}
            dataTestId="checkout-asset"
          />
          <AssetAssigneePicker
            id="checkout-borrower"
            label={t("assets.checkout.borrower")}
            value={borrower}
            onSelect={setBorrower}
            includeInvited={false}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="checkout-expected-field" className="block text-sm">
              {t("assets.checkout.expectedReturn")}
              <input id="checkout-expected-field"
                className="form-input mt-1"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
                data-testid="checkout-expected"
              />
            </label>
            <label htmlFor="checkout-condition-field" className="block text-sm">
              {t("assets.checkout.conditionOut")}
              <select id="checkout-condition-field" className="form-input mt-1" value={conditionOut} onChange={(e) => setConditionOut(e.target.value)} data-testid="checkout-condition">
                {CONDITIONS.map((c) => <option key={c} value={c}>{t(`assets.checkout.condition.${c}`)}</option>)}
              </select>
            </label>
          </div>
          <label htmlFor="checkout-purpose-field" className="block text-sm">
            {t("assets.checkout.purpose")}
            <input id="checkout-purpose-field"
              className="form-input mt-1"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              maxLength={500}
              placeholder={t("assets.checkout.purposePlaceholder")}
              data-testid="checkout-purpose"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setNewOpen(false)}>{t("common.cancel")}</button>
            <button type="submit" className="btn-primary" disabled={busy || !asset || !borrower} data-testid="checkout-submit">
              {t("assets.checkout.submit")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={returning !== null}
        onClose={() => setReturning(null)}
        title={t("assets.checkout.return")}
        description={returning?.asset ? `${returning.asset.tag_number || returning.asset.asset_code || ""} ${returning.asset.name ?? ""} · ${returning.borrower?.name ?? ""}` : undefined}
      >
        <form className="space-y-4" onSubmit={submitReturn} data-testid="checkout-return-form">
          <label htmlFor="checkout-condition-in-field" className="block text-sm">
            {t("assets.checkout.conditionIn")}
            <select id="checkout-condition-in-field"
              className="form-input mt-1"
              value={conditionIn}
              onChange={(e) => {
                setConditionIn(e.target.value);
                if (e.target.value === "damaged") setDamage(true);
              }}
              data-testid="checkout-condition-in"
            >
              {CONDITIONS.map((c) => <option key={c} value={c}>{t(`assets.checkout.condition.${c}`)}</option>)}
            </select>
          </label>
          <label htmlFor="checkout-damage-field" className="flex items-center gap-2 text-sm">
            <input id="checkout-damage-field" type="checkbox" checked={damage} onChange={(e) => setDamage(e.target.checked)} data-testid="checkout-damage" />
            {t("assets.checkout.damageReported")}
          </label>
          <label htmlFor="checkout-return-notes-field" className="block text-sm">
            {t("assets.view.fieldNotes")}
            <textarea id="checkout-return-notes-field" className="form-input mt-1" rows={3} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} maxLength={2000} data-testid="checkout-return-notes" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setReturning(null)}>{t("common.cancel")}</button>
            <button type="submit" className="btn-primary" disabled={busy} data-testid="checkout-return-submit">{t("assets.checkout.confirmReturn")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
