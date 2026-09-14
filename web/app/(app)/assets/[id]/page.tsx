"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { assetsApi, type Asset, type AssetTimelineEvent, type GenericAssetAttachment } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { apiErrorMessage } from "@/lib/apiError";
import { canManageAssets, getStoredUser } from "@/lib/auth";
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

export default function AssetViewPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [timeline, setTimeline] = useState<AssetTimelineEvent[]>([]);
  const [docs, setDocs] = useState<GenericAssetAttachment[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

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
        void assetsApi.timeline(numericId).then((r) => { if (!cancelled) setTimeline(r.data.data ?? []); }).catch(() => undefined);
        setDocsLoading(true);
        void assetsApi.documents(numericId).then((r) => { if (!cancelled) setDocs(r.data.data ?? []); }).catch(() => undefined).finally(() => { if (!cancelled) setDocsLoading(false); });
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
            <Field label={t("assets.assignedTo")} value={asset.assigned_user?.name ?? t("assets.notAssigned")} />
            <Field label={t("assets.view.fieldSerial")} value={asset.serial_number ?? "—"} />
            <Field label={t("assets.view.fieldTag")} value={asset.tag_number ?? "—"} />
            <Field label={t("assets.view.fieldPurchaseDate")} value={formatDateShort(asset.purchase_date)} />
            <Field label={t("assets.view.fieldPurchaseValue")} value={asset.purchase_value == null ? "—" : money(asset.purchase_value)} />
            <Field label={t("assets.view.fieldBookValue")} value={bookValue == null ? "—" : money(bookValue)} />
            <Field label={t("assets.view.fieldIssued")} value={formatDateShort(asset.issued_at)} />
            <Field label={t("assets.view.fieldCustody")} value={asset.custody_state ?? "—"} />
            <Field label={t("assets.view.fieldAge")} value={asset.age_display ?? "—"} />
          </div>
          {asset.notes && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-500">{t("assets.view.fieldNotes")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{asset.notes}</p>
            </div>
          )}
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
