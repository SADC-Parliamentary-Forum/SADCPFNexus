"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { assetsApi, type Asset, type AssetCustodyPeriod, type AssetTimelineEvent, type GenericAssetAttachment } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { apiErrorMessage } from "@/lib/apiError";
import { assigneeDepartmentName } from "@/lib/asset-assignee";
import { canManageAssets, canManageHandovers, getStoredUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending capitalisation",
  active: "Active",
  assigned: "Assigned",
  available: "Available",
  service_due: "Service due",
  loan_out: "Loan out",
  retired: "Retired",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900 break-words">{value || "—"}</p>
    </div>
  );
}

function money(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.max(1, Math.floor(seconds / 60));
  return `${minutes}m`;
}

export default function AssetViewPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [timeline, setTimeline] = useState<AssetTimelineEvent[]>([]);
  const [custody, setCustody] = useState<{ owner: string; history: AssetCustodyPeriod[] }>({
    owner: "SADC Parliamentary Forum",
    history: [],
  });
  const [docs, setDocs] = useState<GenericAssetAttachment[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parentId, setParentId] = useState("");
  const [parentBusy, setParentBusy] = useState(false);
  const [parentOptions, setParentOptions] = useState<Asset[]>([]);

  useEffect(() => {
    setCanEdit(canManageAssets(getStoredUser()));
  }, []);

  useEffect(() => {
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setLoading(false);
      setError(t("assets.notFound"));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    assetsApi
      .get(numericId)
      .then((res) => {
        if (!cancelled) setAsset(res.data);
        if (!cancelled) setParentId(res.data.parent_asset_id ? String(res.data.parent_asset_id) : "");
        void assetsApi.timeline(numericId).then((r) => { if (!cancelled) setTimeline(r.data.data ?? []); }).catch(() => undefined);
        void assetsApi.custodyHistory(numericId).then((r) => {
          if (!cancelled) {
            setCustody({
              owner: r.data.data.owner || "SADC Parliamentary Forum",
              history: r.data.data.history ?? [],
            });
          }
        }).catch(() => undefined);
        setDocsLoading(true);
        void assetsApi.documents(numericId).then((r) => { if (!cancelled) setDocs(r.data.data ?? []); }).catch(() => undefined).finally(() => { if (!cancelled) setDocsLoading(false); });
        void assetsApi.list({ per_page: 100 }).then((r) => { if (!cancelled) setParentOptions(r.data.data ?? []); }).catch(() => undefined);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status === 404 ? t("assets.notFound") : apiErrorMessage(err, t("assets.loadFailed")),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numericId, t]);

  const bookValue = asset?.current_value ?? asset?.book_value ?? asset?.value ?? null;
  const parentAsset = parentOptions.find((row) => row.id === asset?.parent_asset_id);
  const parentLabel = parentAsset
    ? `${parentAsset.tag_number || parentAsset.asset_code} — ${parentAsset.name}`
    : (asset?.parent_asset_id ? String(asset.parent_asset_id) : "—");

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap" data-testid="asset-view-title">
        <ModulePageHeader
          title={asset?.name ?? "assets.viewTitle"}
          subtitle={asset?.asset_code ?? "assets.view"}
          breadcrumbs={
            <PageBreadcrumbs
              items={[
                { href: "/assets", label: "assets.register.title" },
                { label: asset?.asset_code ?? "assets.viewTitle" },
              ]}
            />
          }
        />
        <div className="flex gap-2">
          <Link href="/assets" className="btn-secondary">
            {t("common.back")}
          </Link>
          {canEdit && asset && (
            <Link href={`/assets/${asset.id}/edit`} className="btn-primary">
              {t("common.edit")}
            </Link>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {asset && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("assets.view.fieldCode")} value={asset.asset_code} />
            <Field label={t("assets.view.fieldStatus")} value={STATUS_LABELS[asset.status] ?? asset.status} />
            <Field label={t("assets.view.fieldCategory")} value={asset.category} />
            <Field label={t("assets.handover.owner")} value={asset.owner_name || custody.owner || t("assets.handover.ownerValue")} />
            {asset.assigned_user?.name && (
              <>
                <Field label={t("assets.assignedTo")} value={asset.assigned_user.name} />
                <Field label={t("assets.assigneeEmail")} value={asset.assigned_user.email ?? "—"} />
                <Field
                  label={t("assets.assigneeDepartment")}
                  value={assigneeDepartmentName(asset.assigned_user) ?? asset.department ?? "—"}
                />
              </>
            )}
            <Field label={t("assets.view.fieldSerial")} value={asset.serial_number ?? "—"} />
            <Field label={t("assets.view.fieldTag")} value={asset.tag_number ?? "—"} />
            <Field label={t("assets.view.fieldPurchaseDate")} value={formatDateShort(asset.purchase_date)} />
            <Field label={t("assets.view.fieldPurchaseValue")} value={asset.purchase_value == null ? "—" : money(asset.purchase_value)} />
            <Field label={t("assets.view.fieldBookValue")} value={bookValue == null ? "—" : money(bookValue)} />
            <Field label={t("assets.view.fieldIssued")} value={formatDateShort(asset.issued_at)} />
            <Field label={t("assets.view.fieldCustody")} value={asset.custody_state ?? "—"} />
            <Field label={t("assets.view.fieldAge")} value={asset.age_display ?? "—"} />
            <Field label={t("assets.parent.title")} value={parentLabel} />
          </div>
          {canManageHandovers(getStoredUser()) && (
            <form
              className="card flex flex-wrap items-end gap-2 p-4"
              data-testid="asset-parent-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setParentBusy(true);
                try {
                  const updated = await assetsApi.setParent(asset.id, parentId ? Number(parentId) : null);
                  setAsset((cur) => cur ? { ...cur, parent_asset_id: updated.data.data.parent_asset_id } : cur);
                } catch (err) {
                  setError(apiErrorMessage(err, t("assets.mine.actionFailed")));
                } finally {
                  setParentBusy(false);
                }
              }}
            >
              <label className="text-sm">
                {t("assets.parent.title")}
                <select
                  className="form-input mt-1"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  data-testid="asset-parent-select"
                >
                  <option value="">{t("assets.parent.none")}</option>
                  {parentOptions.filter((row) => row.id !== asset.id).map((row) => (
                    <option key={row.id} value={row.id}>{row.tag_number || row.asset_code} — {row.name}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn-secondary" disabled={parentBusy} data-testid="asset-parent-set">{t("assets.parent.set")}</button>
              <button
                type="button"
                className="btn-secondary"
                disabled={parentBusy}
                data-testid="asset-parent-clear"
                onClick={async () => {
                  setParentBusy(true);
                  try {
                    const updated = await assetsApi.setParent(asset.id, null);
                    setParentId("");
                    setAsset((cur) => cur ? { ...cur, parent_asset_id: updated.data.data.parent_asset_id } : cur);
                  } finally {
                    setParentBusy(false);
                  }
                }}
              >
                {t("assets.parent.clear")}
              </button>
            </form>
          )}
          {asset.notes && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-500">{t("assets.view.fieldNotes")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{asset.notes}</p>
            </div>
          )}
          <section className="card p-4" data-testid="custody-history">
            <h2 className="mb-3 text-sm font-semibold">{t("assets.handover.custodyHistory")}</h2>
            {custody.history.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("assets.timeline.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("assets.handover.inCustodyOf")}</th>
                      <th>{t("assets.handover.type")}</th>
                      <th>{t("assets.handover.duration")}</th>
                      <th>{t("assets.handover.certificate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custody.history.map((row) => (
                      <tr key={row.id}>
                        <td>{row.custodian_name || row.custodian_type || "—"}</td>
                        <td>{row.custodian_type || "—"}{row.open ? ` · ${t("assets.handover.needsAttention")}` : ""}</td>
                        <td>{formatDuration(row.duration_seconds)}</td>
                        <td>
                          {row.certificate_available && row.handover_id ? (
                            <a className="text-xs font-semibold text-primary underline" href={assetsApi.handoverCertificateUrl(row.handover_id)}>
                              {row.handover_reference || t("assets.handover.certificate")}
                            </a>
                          ) : (row.handover_reference || "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("assets.timeline.title")}</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("assets.timeline.empty")}</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {timeline.map((ev) => (
                  <li key={ev.id} className="flex justify-between gap-3 border-b border-neutral-100 py-2">
                    <span>{ev.summary || ev.event_type}</span>
                    <span className="text-xs text-neutral-500">{ev.occurred_at || ev.created_at}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <GenericDocumentsPanel
            documents={docs}
            documentTypes={[
              { value: "invoice", label: "Invoice" },
              { value: "warranty", label: "Warranty" },
              { value: "police_report", label: "Police report" },
              { value: "photo_primary", label: "Primary photo" },
              { value: "photo_serial", label: "Serial plate" },
              { value: "photo_damage", label: "Damage" },
              { value: "other", label: "Other" },
            ]}
            defaultType="invoice"
            loading={docsLoading}
            uploading={uploading}
            readOnly={!canEdit}
            onUpload={async (file, type) => {
              setUploading(true);
              try {
                const res = await assetsApi.uploadDocument(numericId, file, type);
                if (res.data.data) setDocs((prev) => [res.data.data, ...prev]);
              } finally {
                setUploading(false);
              }
            }}
            onDelete={async (id) => {
              await assetsApi.deleteDocument(numericId, id);
              setDocs((prev) => prev.filter((d) => d.id !== id));
            }}
            downloadUrl={(id) => assetsApi.documentDownloadUrl(numericId, id)}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
        </>
      )}
    </div>
  );
}
