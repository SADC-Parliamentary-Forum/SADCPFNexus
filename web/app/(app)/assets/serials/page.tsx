"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { assetCategoriesApi, assetsApi, type Asset, type AssetCategory } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { SearchField } from "@/components/ui/SearchField";
import { isSerialConflict } from "@/components/assets/AssetIdentifierFields";

type SerialFilter = "missing" | "present" | "all";

const PER_PAGE = 50;

function canCaptureSerials(): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["assets.admin", "assets.manage"]);
}

/** One asset with its own draft, so typing in a row never re-renders the list. */
function SerialRow({ asset }: { asset: Asset }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState({
    serial_number: asset.serial_number ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
  });
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const dirty =
    draft.serial_number.trim() !== saved.serial_number ||
    draft.manufacturer.trim() !== saved.manufacturer ||
    draft.model.trim() !== saved.model;

  function edit(field: keyof typeof draft, value: string) {
    setDraft((cur) => ({ ...cur, [field]: value }));
    setState("idle");
    if (field === "serial_number") {
      setConflict(false);
      setAllowDuplicate(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await assetsApi.updateIdentifiers(asset.id, {
        serial_number: draft.serial_number.trim() || null,
        manufacturer: draft.manufacturer.trim() || null,
        model: draft.model.trim() || null,
        allow_serial_duplicate: allowDuplicate || undefined,
      });
      const next = {
        serial_number: res.data.serial_number ?? "",
        manufacturer: res.data.manufacturer ?? "",
        model: res.data.model ?? "",
      };
      setSaved(next);
      setDraft(next);
      setConflict(false);
      setAllowDuplicate(false);
      setState("saved");
    } catch (err) {
      setConflict(isSerialConflict(err));
      setError(apiErrorMessage(err, t("assets.serials.saveFailed")));
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  const tag = asset.tag_number || asset.asset_code;
  const where = asset.location?.name || asset.legacy_location || "—";
  const inputCls = "form-input py-1.5 text-sm";

  return (
    <li className="py-3" data-testid={`serial-row-${asset.id}`}>
      <form onSubmit={save} className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <Link href={`/assets/${asset.id}`} className="font-mono text-xs font-semibold text-primary">
            {tag}
          </Link>
          <p className="truncate text-sm text-neutral-900" title={asset.name}>{asset.name}</p>
          <p className="truncate text-xs text-neutral-500">{t("assets.serials.location")}: {where}</p>
        </div>
        <div>
          <label htmlFor={`serial-${asset.id}`} className="sr-only">{t("assets.serial.serialNumber")}</label>
          <input
            id={`serial-${asset.id}`}
            className={`${inputCls} font-mono`}
            placeholder={t("assets.serial.serialNumber")}
            value={draft.serial_number}
            onChange={(e) => edit("serial_number", e.target.value)}
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={conflict || undefined}
            disabled={busy}
            data-testid={`serial-input-${asset.id}`}
          />
        </div>
        <div>
          <label htmlFor={`manufacturer-${asset.id}`} className="sr-only">{t("assets.serial.manufacturer")}</label>
          <input
            id={`manufacturer-${asset.id}`}
            className={inputCls}
            placeholder={t("assets.serial.manufacturer")}
            value={draft.manufacturer}
            onChange={(e) => edit("manufacturer", e.target.value)}
            maxLength={128}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor={`model-${asset.id}`} className="sr-only">{t("assets.serial.model")}</label>
          <input
            id={`model-${asset.id}`}
            className={inputCls}
            placeholder={t("assets.serial.model")}
            value={draft.model}
            onChange={(e) => edit("model", e.target.value)}
            maxLength={128}
            disabled={busy}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="btn-primary px-3 py-1.5 text-sm"
            disabled={!dirty || busy || (conflict && !allowDuplicate)}
            data-testid={`serial-save-${asset.id}`}
          >
            {busy ? t("common.loading") : t("common.save")}
          </button>
          {state === "saved" ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700" role="status">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span>
              {t("assets.serials.saved")}
            </span>
          ) : null}
        </div>
      </form>
      {state === "error" ? (
        <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>
      ) : null}
      {conflict ? (
        <label htmlFor={`allow-duplicate-${asset.id}`} className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <input
            id={`allow-duplicate-${asset.id}`}
            type="checkbox"
            checked={allowDuplicate}
            onChange={(e) => setAllowDuplicate(e.target.checked)}
          />
          <span>{t("assets.serial.allowDuplicate")}</span>
        </label>
      ) : null}
    </li>
  );
}

export default function AssetSerialCapturePage() {
  const { t } = useI18n();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<SerialFilter>("missing");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => setAllowed(canCaptureSerials()), []);

  useEffect(() => {
    if (!allowed) return;
    assetCategoriesApi
      .list()
      .then((res) => setCategories((res.data as { data?: AssetCategory[] }).data ?? []))
      .catch(() => undefined);
  }, [allowed]);

  useEffect(() => {
    setPage(1);
  }, [filter, category, search]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const term = search.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await assetsApi.list({
          serial: filter === "all" ? undefined : filter,
          category: category || undefined,
          search: term || undefined,
          per_page: PER_PAGE,
          page,
        });
        if (cancelled) return;
        setRows(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(apiErrorMessage(err, t("assets.loadFailed")));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, term ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [allowed, filter, category, search, page, t]);

  if (allowed === null) return null;

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.serials.title"
        subtitle="assets.serials.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets", label: "nav.assets" }, { label: "assets.serials.title" }]} />}
      />

      {!allowed ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("assets.serials.noAccess")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <span>{t("assets.serials.reprintHint")}</span>
            <Link href="/assets/labels" className="btn-secondary px-3 py-1 text-xs">{t("assets.serials.openLabels")}</Link>
          </div>

          <div className="card space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <SearchField value={search} onChange={setSearch} placeholder={t("assets.serials.search")} testId="serials-search" />
              <div>
                <label htmlFor="serials-filter" className="sr-only">{t("assets.serials.filterLabel")}</label>
                <select
                  id="serials-filter"
                  className="form-input"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as SerialFilter)}
                  data-testid="serials-filter"
                >
                  <option value="missing">{t("assets.serials.filterMissing")}</option>
                  <option value="present">{t("assets.serials.filterPresent")}</option>
                  <option value="all">{t("assets.serials.filterAll")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="serials-category" className="sr-only">{t("assets.serials.allCategories")}</label>
                <select
                  id="serials-category"
                  className="form-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  data-testid="serials-category"
                >
                  <option value="">{t("assets.serials.allCategories")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-neutral-500" data-testid="serials-total">{t("assets.serials.total", { count: total })}</p>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

            {loading ? (
              <p className="py-4 text-sm text-neutral-500">{t("common.loading")}</p>
            ) : rows.length === 0 ? (
              <p className="py-4 text-sm text-neutral-500" data-testid="serials-empty">{t("assets.serials.empty")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100" aria-label={t("assets.serials.title")}>
                {rows.map((asset) => (
                  <SerialRow key={asset.id} asset={asset} />
                ))}
              </ul>
            )}

            {lastPage > 1 ? (
              <div className="flex items-center justify-between pt-2">
                <button type="button" className="btn-secondary px-3 py-1 text-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  {t("assets.serials.previous")}
                </button>
                <span className="text-xs text-neutral-500">{page} / {lastPage}</span>
                <button type="button" className="btn-secondary px-3 py-1 text-sm" disabled={page >= lastPage || loading} onClick={() => setPage((p) => p + 1)}>
                  {t("assets.serials.next")}
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
