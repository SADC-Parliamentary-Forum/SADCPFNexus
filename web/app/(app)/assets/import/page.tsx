"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { adminApi, assetImportApi, assetMetaApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormSection";
import { ListPagination } from "@/components/ui/ListPagination";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Counts = Record<string, number>;
type StagingRow = {
  id: number;
  asset_tag: string | null;
  asset_name: string | null;
  serial_number: string | null;
  model: string | null;
  make: string | null;
  legacy_location: string | null;
  location_id: number | null;
  custodian_candidate: string | null;
  custodian_type: string | null;
  proposed_action: string;
  review_status: string;
  blocking: boolean;
  current_book_value: string | null;
  original_cost: string | null;
  data_quality_flags?: string[];
  blocking_errors?: string[];
  source_refs?: { raw_id: number; kind: string }[];
};
type BatchSummary = { id: number; batch_number: string; status: string };
type Location = { id: number; name: string; code: string };
type Department = { id: number; name: string };
type Discrepancy = {
  asset_tag: string;
  field: string;
  source_a_value?: string | null;
  source_b_value?: string | null;
  chosen_value?: string | null;
};
type Equation = {
  unique_source_tags?: number;
  created?: number;
  matched_existing?: number;
  approved_exclusions?: number;
  outstanding_exceptions?: number;
  balanced?: boolean;
};

const FILTERS = [
  "all",
  "pending",
  "blocking",
  "missing_serial",
  "missing_location",
  "unmapped_custodian",
  "approved",
  "excluded",
] as const;

const COUNT_FILTER: Record<string, (typeof FILTERS)[number]> = {
  blocking_errors: "blocking",
  missing_serial: "missing_serial",
  missing_location: "missing_location",
  unmapped_custodian: "unmapped_custodian",
  excluded: "excluded",
  pending_review: "pending",
};

function filterKey(filter: string): string {
  if (filter === "all") return "assets.import.filterAll";
  if (filter === "pending") return "assets.import.filterPending";
  if (filter === "blocking") return "assets.import.filterBlocking";
  if (filter === "missing_serial") return "assets.import.filterMissingSerial";
  if (filter === "missing_location") return "assets.import.filterMissingLocation";
  if (filter === "unmapped_custodian") return "assets.import.filterUnmappedCustodian";
  if (filter === "approved") return "assets.import.filterApproved";
  if (filter === "excluded") return "assets.import.filterExcluded";
  return filter;
}

export default function AssetImportPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"legacy" | "template">("legacy");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [equation, setEquation] = useState<Equation | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [rows, setRows] = useState<StagingRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<StagingRow | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mapLocationId, setMapLocationId] = useState<number | "">("");
  const [custodianType, setCustodianType] = useState("shared");
  const [custodianDepartmentId, setCustodianDepartmentId] = useState<number | "">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const loadPreview = useCallback(async (id: number) => {
    const r = await assetImportApi.show(id);
    const payload = r.data.data as {
      batch?: { id: number; status: string };
      counts?: Counts;
      equation?: Equation;
      discrepancies?: Discrepancy[];
    };
    setBatchId(payload.batch?.id ?? id);
    setBatchStatus(payload.batch?.status ?? "");
    setCounts(payload.counts ?? null);
    setEquation(payload.equation ?? null);
    setDiscrepancies(Array.isArray(payload.discrepancies) ? payload.discrepancies : []);
  }, []);

  const loadStaging = useCallback(async (id: number, nextFilter = filter, nextPage = page, nextSearch = search) => {
    const r = await assetImportApi.staging(id, {
      filter: nextFilter === "all" ? undefined : nextFilter,
      per_page: 50,
      page: nextPage,
      search: nextSearch || undefined,
    });
    const body = r.data as { data?: StagingRow[]; current_page?: number; last_page?: number; total?: number };
    setRows(Array.isArray(body.data) ? body.data : []);
    setPage(body.current_page ?? 1);
    setLastPage(body.last_page ?? 1);
    setTotal(body.total ?? 0);
  }, [filter, page, search]);

  useEffect(() => {
    assetImportApi.list({ per_page: 10 }).then((r) => {
      const body = r.data as { data?: BatchSummary[] };
      setBatches(Array.isArray(body.data) ? body.data : []);
    }).catch(() => setBatches([]));
    assetMetaApi.locations().then((r) => setLocations(r.data.data ?? [])).catch(() => setLocations([]));
    adminApi.listDepartments().then((r) => {
      setDepartments((r.data as { data?: Department[] }).data ?? []);
    }).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!batchId) return;
    loadStaging(batchId).catch(() => setRows([]));
  }, [batchId, filter, page, search, loadStaging]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("mode", mode);
    try {
      const res = await assetImportApi.upload(form);
      const payload = res.data.data as { batch?: { id: number; status: string }; counts?: Counts; equation?: Equation };
      setBatchId(payload.batch?.id ?? null);
      setBatchStatus(payload.batch?.status ?? "");
      setCounts(payload.counts ?? null);
      setEquation(payload.equation ?? null);
      setMsg(res.data.message);
      setPage(1);
      setFilter("all");
      if (payload.batch?.id) await loadPreview(payload.batch.id);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function approveReady() {
    if (!batchId) return;
    setBusy(true);
    try {
      const r = await assetImportApi.approve(batchId, { all_non_blocking: true });
      setMsg((r.data as { message?: string }).message ?? t("assets.import.approveReady"));
      await loadPreview(batchId);
      await loadStaging(batchId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function approveSelected() {
    if (!batchId || selected.length === 0) return;
    setBusy(true);
    try {
      const r = await assetImportApi.approve(batchId, { staging_ids: selected });
      setMsg((r.data as { message?: string }).message ?? t("assets.import.approveSelected"));
      setSelected([]);
      await loadPreview(batchId);
      await loadStaging(batchId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!batchId) return;
    setBusy(true);
    try {
      const r = await assetImportApi.commit(batchId, { approve_non_blocking: true });
      const payload = r.data as { message?: string; data?: { batch?: { status: string }; equation?: Equation } };
      setMsg(payload.message ?? t("assets.import.commit"));
      setBatchStatus(payload.data?.batch?.status ?? batchStatus);
      setEquation(payload.data?.equation ?? equation);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function exclude(row: StagingRow) {
    if (!batchId) return;
    const reason = window.prompt(t("assets.import.excludePrompt")) || t("assets.import.excludeReason");
    await assetImportApi.exclude(batchId, row.id, reason);
    await loadPreview(batchId);
    await loadStaging(batchId);
  }

  async function showRaw(row: StagingRow) {
    if (!batchId || !row.source_refs?.length) return;
    const payloads = await Promise.all(
      row.source_refs.map((ref) => assetImportApi.raw(batchId, ref.raw_id).then((r) => ({
        kind: ref.kind,
        data: (r.data as { data?: unknown }).data ?? r.data,
      }))),
    );
    setRaw(payloads);
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!batchId || !editing) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await assetImportApi.updateStaging(batchId, editing.id, {
        asset_name: form.get("asset_name"),
        serial_number: form.get("serial_number"),
        model: form.get("model"),
        make: form.get("make"),
        admin_notes: form.get("admin_notes"),
      });
      setEditing(null);
      await loadStaging(batchId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function markSerialUnavailable() {
    if (!batchId || !editing) return;
    await assetImportApi.updateStaging(batchId, editing.id, {
      serial_number: null,
      admin_notes: t("assets.import.markSerialUnavailable"),
    });
    setEditing(null);
    await loadStaging(batchId);
  }

  async function confirmLocationMap() {
    if (!batchId || !editing?.legacy_location) return;
    let locationId = mapLocationId === "" ? null : Number(mapLocationId);
    setBusy(true);
    try {
      if (!locationId) {
        const created = await assetMetaApi.createLocation({
          code: editing.legacy_location.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 64).toUpperCase() || "LOC",
          name: editing.legacy_location,
          legacy_name: editing.legacy_location,
          location_type: "office",
        });
        locationId = created.data.data.id;
        setLocations((cur) => [...cur, created.data.data]);
      }
      await assetImportApi.mapLocation(batchId, {
        legacy_location: editing.legacy_location,
        location_id: locationId,
      });
      setMsg(t("assets.import.mapLocation"));
      await loadPreview(batchId);
      await loadStaging(batchId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCustodianMap() {
    if (!batchId || !editing) return;
    const legacyKey = editing.custodian_candidate || editing.legacy_location;
    if (!legacyKey) return;
    setBusy(true);
    try {
      await assetImportApi.mapCustodian(batchId, {
        legacy_key: legacyKey,
        custodian_type: custodianType,
        department_id: custodianType === "department" && custodianDepartmentId !== "" ? custodianDepartmentId : null,
        location_id: custodianType === "store" && mapLocationId !== "" ? mapLocationId : null,
      });
      setMsg(t("assets.import.mapCustodian"));
      await loadPreview(batchId);
      await loadStaging(batchId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title={t("assets.import.title")}
          subtitle={t("assets.import.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.import.title") }]} />}
        />
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {batches.length > 0 && (
        <FormSection title="assets.import.batches" dense>
          <ul className="space-y-2 text-sm">
            {batches.map((batch) => (
              <li key={batch.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{batch.batch_number}</span>
                <span className="text-neutral-500">{batch.status}</span>
                <Button type="button" variant="secondary" onClick={() => { setPage(1); loadPreview(batch.id); }}>
                  {t("assets.import.loadBatch")}
                </Button>
              </li>
            ))}
          </ul>
        </FormSection>
      )}

      <form onSubmit={onUpload} className="card space-y-3 p-4">
        <div className="flex gap-3">
          <label className="text-sm">
            <input type="radio" checked={mode === "legacy"} onChange={() => setMode("legacy")} /> {t("assets.import.legacy")}
          </label>
          <label className="text-sm">
            <input type="radio" checked={mode === "template"} onChange={() => setMode("template")} /> {t("assets.import.template")}
          </label>
        </div>
        {mode === "legacy" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">{t("assets.import.categoryFile")}<input className="input mt-1" type="file" name="category" accept=".xls,.xlsx" required /></label>
            <label className="text-sm">{t("assets.import.locationFile")}<input className="input mt-1" type="file" name="location" accept=".xls,.xlsx" required /></label>
            <label className="text-sm">{t("assets.import.stagingFile")}<input className="input mt-1" type="file" name="staging" accept=".xlsx" /></label>
          </div>
        ) : (
          <label className="text-sm">{t("assets.import.template")}<input className="input mt-1" type="file" name="template" accept=".xlsx" required /></label>
        )}
        <Button type="submit" disabled={busy}>{busy ? t("common.loading") : t("assets.import.upload")}</Button>
      </form>

      {counts && (
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(counts).map(([k, v]) => (
            <button
              key={k}
              type="button"
              className="card p-3 text-left"
              onClick={() => {
                const next = COUNT_FILTER[k];
                if (next) {
                  setFilter(next);
                  setPage(1);
                }
              }}
            >
              <div className="text-xs text-neutral-500">{t(`assets.import.count.${k}`)}</div>
              <div className="text-lg font-semibold">{v}</div>
            </button>
          ))}
        </div>
      )}

      {equation && (
        <p className="text-sm text-neutral-600">
          {t("assets.import.equation")}: {equation.unique_source_tags ?? 0} = {(equation.created ?? 0) + (equation.matched_existing ?? 0) + (equation.approved_exclusions ?? 0) + (equation.outstanding_exceptions ?? 0)}
        </p>
      )}

      {discrepancies.length > 0 && (
        <FormSection title="assets.import.discrepancies" dense>
          <ul className="max-h-40 space-y-1 overflow-auto text-sm">
            {discrepancies.slice(0, 20).map((d, idx) => (
              <li key={`${d.asset_tag}-${d.field}-${idx}`}>
                <span className="font-mono">{d.asset_tag}</span> {d.field}: {d.source_a_value ?? "—"} / {d.source_b_value ?? "—"}
              </li>
            ))}
          </ul>
        </FormSection>
      )}

      {batchId && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={approveSelected} disabled={busy || selected.length === 0}>{t("assets.import.approveSelected")}</Button>
          <Button type="button" onClick={approveReady} disabled={busy}>{t("assets.import.approveReady")}</Button>
          <Button type="button" onClick={commit} disabled={busy}>{t("assets.import.commit")}</Button>
          <p className="self-center text-xs text-neutral-500">{t("assets.import.commitHint")} {batchStatus}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">{t("common.search")}
          <input className="input mt-1" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm ${filter === f ? "border-primary font-semibold" : "border-neutral-200"}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {t(filterKey(f))}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>{t("assets.import.colTag")}</th>
              <th>{t("assets.import.colName")}</th>
              <th>{t("assets.import.colSerial")}</th>
              <th>{t("assets.import.colLocation")}</th>
              <th>{t("assets.import.colAction")}</th>
              <th>{t("assets.import.colStatus")}</th>
              <th>{t("assets.import.colCost")}</th>
              <th>{t("assets.import.colNbv")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.blocking ? "bg-red-50" : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, row.id] : cur.filter((id) => id !== row.id))}
                    disabled={row.blocking}
                    aria-label={row.asset_tag ?? t("assets.import.approveSelected")}
                  />
                </td>
                <td>{row.asset_tag}</td>
                <td>{row.asset_name}</td>
                <td>{row.serial_number ?? "—"}</td>
                <td>{row.legacy_location ?? "—"}</td>
                <td>{row.proposed_action}</td>
                <td>{row.review_status}</td>
                <td>{row.original_cost ?? "—"}</td>
                <td>{row.current_book_value ?? "—"}</td>
                <td className="space-x-2">
                  <button type="button" onClick={() => setEditing(row)}>{t("common.edit")}</button>
                  <button type="button" onClick={() => showRaw(row)}>{t("assets.import.compare")}</button>
                  <button type="button" onClick={() => exclude(row)}>{t("assets.import.exclude")}</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10}>{t("common.noResults")}</td></tr>}
          </tbody>
        </table>
        <ListPagination page={page} lastPage={lastPage} total={total} onPageChange={setPage} disabled={busy} />
      </div>

      {editing && (
        <FormSection title="common.edit" description={editing.asset_tag ?? undefined} dense>
          <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t("assets.import.colName")}<input className="input mt-1" name="asset_name" defaultValue={editing.asset_name ?? ""} /></label>
            <label className="text-sm">{t("assets.import.colSerial")}<input className="input mt-1" name="serial_number" defaultValue={editing.serial_number ?? ""} /></label>
            <label className="text-sm">{t("assets.import.colMake")}<input className="input mt-1" name="make" defaultValue={editing.make ?? ""} /></label>
            <label className="text-sm">{t("assets.import.colModel")}<input className="input mt-1" name="model" defaultValue={editing.model ?? ""} /></label>
            <label className="text-sm sm:col-span-2">{t("assets.import.notes")}<input className="input mt-1" name="admin_notes" /></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy}>{t("common.save")}</Button>
              <Button type="button" variant="secondary" onClick={markSerialUnavailable}>{t("assets.import.markSerialUnavailable")}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{t("common.close")}</Button>
            </div>
          </form>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t("assets.import.nexusLocation")}
              <select className="input mt-1" value={mapLocationId} onChange={(e) => setMapLocationId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">{t("assets.import.createLocation")}</option>
                {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </label>
            <div className="self-end">
              <Button type="button" onClick={confirmLocationMap} disabled={busy || !editing.legacy_location}>{t("assets.import.mapLocation")}</Button>
            </div>
            <label className="text-sm">{t("assets.import.custodianType")}
              <select className="input mt-1" value={custodianType} onChange={(e) => setCustodianType(e.target.value)}>
                <option value="shared">{t("assets.import.custodianShared")}</option>
                <option value="store">{t("assets.import.custodianStore")}</option>
                <option value="department">{t("assets.import.custodianDepartment")}</option>
                <option value="user">{t("assets.import.custodianUser")}</option>
              </select>
            </label>
            {custodianType === "department" && (
              <label className="text-sm">{t("assets.import.custodianDepartment")}
                <select className="input mt-1" value={custodianDepartmentId} onChange={(e) => setCustodianDepartmentId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value=""></option>
                  {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
              </label>
            )}
            <div className="self-end">
              <Button type="button" onClick={confirmCustodianMap} disabled={busy}>{t("assets.import.mapCustodian")}</Button>
            </div>
          </div>
        </FormSection>
      )}

      {raw != null && (
        <pre className="card overflow-auto p-3 text-xs">{JSON.stringify(raw, null, 2)}</pre>
      )}
    </div>
  );
}
