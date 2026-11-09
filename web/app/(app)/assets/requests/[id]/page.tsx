"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { assetRequestsApi, type AssetRequest } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "assets.requests.status.pending", badge: "badge-warning" },
  approved: { label: "assets.requests.status.approved", badge: "badge-success" },
  rejected: { label: "assets.requests.status.rejected", badge: "badge-danger" },
  fulfilled: { label: "assets.requests.status.fulfilled", badge: "badge-info" },
};

function padId(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

export default function AssetRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();
  const { t } = useI18n();
  const [request, setRequest] = useState<AssetRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const numericId = Number(id);
  const user = getStoredUser();
  const isAdmin = isSystemAdmin(user) || hasPermission(user, "assets.admin");
  const isOwner = request != null && user?.id === request.requester_id;
  const pending = request?.status === "pending";

  useEffect(() => {
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setLoading(false);
      setError(t("assets.requests.detail.notFound"));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    assetRequestsApi
      .get(numericId)
      .then((res) => {
        if (!cancelled) setRequest(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status === 404
            ? t("assets.requests.detail.notFound")
            : apiErrorMessage(err, t("assets.requests.detail.loadFailed")),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numericId, t]);

  const setStatus = async (status: "approved" | "rejected") => {
    if (!request) return;
    const ok = await confirm({
      title: status === "approved" ? t("assets.requests.detail.approveTitle") : t("assets.requests.detail.rejectTitle"),
      message:
        status === "approved"
          ? t("assets.requests.detail.approveConfirm", { ref: padId(request.id) })
          : t("assets.requests.detail.rejectConfirm", { ref: padId(request.id) }),
      confirmText: status === "approved" ? t("common.approve") : t("common.reject"),
      variant: status === "rejected" ? "danger" : "primary",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await assetRequestsApi.update(request.id, { status });
      setRequest(res.data);
      success(status === "approved" ? t("assets.requests.detail.approved") : t("assets.requests.detail.rejected"));
    } catch (err) {
      toastError(apiErrorMessage(err, t("assets.requests.detail.updateFailed")));
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (!request) return;
    const ok = await confirm({
      title: t("assets.requests.detail.cancelTitle"),
      message: t("assets.requests.detail.cancelConfirm", { ref: padId(request.id) }),
      confirmText: t("assets.requests.detail.cancelTitle"),
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await assetRequestsApi.remove(request.id);
      success(t("assets.requests.detail.cancelled"));
      router.push("/assets/requests");
    } catch (err) {
      toastError(apiErrorMessage(err, t("assets.requests.detail.cancelFailed")));
      setBusy(false);
    }
  };

  const known = request ? STATUS_CONFIG[request.status] : undefined;
  const sc = request ? (known ? { label: t(known.label), badge: known.badge } : { label: request.status, badge: "badge-muted" }) : null;

  return (
    <div className="w-full space-y-6">
      <ModulePageHeader
        title={request ? t("assets.requests.detail.titleWithId", { ref: padId(request.id) }) : t("assets.requests.detail.title")}
        subtitle={request?.requester?.name ? t("assets.requests.detail.submittedBy", { name: request.requester.name }) : t("assets.requests.detail.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "assets.requests.breadcrumbAssets", href: "/assets" },
              { label: "assets.requests.breadcrumb", href: "/assets/requests" },
              { label: request ? padId(request.id) : "assets.requests.detail.request" },
            ]}
          />
        }
        meta={sc ? <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span> : null}
        actions={
          pending && (isAdmin || isOwner) ? (
            <div className="flex flex-wrap gap-2">
              {isAdmin ? (
                <>
                  <button type="button" className="btn-primary py-2 px-4 text-sm" disabled={busy} onClick={() => void setStatus("approved")}>
                    {t("common.approve")}
                  </button>
                  <button type="button" className="btn-secondary py-2 px-4 text-sm" disabled={busy} onClick={() => void setStatus("rejected")}>
                    {t("common.reject")}
                  </button>
                </>
              ) : null}
              {isOwner ? (
                <button type="button" className="btn-secondary py-2 px-4 text-sm" disabled={busy} onClick={() => void cancelRequest()}>
                  {t("assets.requests.detail.cancelTitle")}
                </button>
              ) : null}
            </div>
          ) : null
        }
      />

      {loading ? (
        <div className="card p-6 space-y-3">
          <div className="h-4 w-40 rounded bg-neutral-100 animate-pulse" />
          <div className="h-24 rounded bg-neutral-100 animate-pulse" />
        </div>
      ) : error ? (
        <div className="card p-6 space-y-4">
          <p className="text-sm text-red-700">{error}</p>
          <Link href="/assets/requests" className="btn-secondary inline-flex py-2 px-4 text-sm">
            {t("assets.requests.detail.back")}
          </Link>
        </div>
      ) : request ? (
        <div className="card p-6 space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.requests.col.reference")}</dt>
              <dd className="mt-1 font-mono text-sm text-neutral-900">{padId(request.id)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.requests.col.submitted")}</dt>
              <dd className="mt-1 text-sm text-neutral-900">{formatDate(request.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.requests.col.requester")}</dt>
              <dd className="mt-1 text-sm text-neutral-900">{request.requester?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.requests.detail.email")}</dt>
              <dd className="mt-1 text-sm text-neutral-900">{request.requester?.email ?? "—"}</dd>
            </div>
          </dl>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.requests.col.justification")}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{request.justification}</p>
          </div>
          <div>
            <Link href="/assets/requests" className="btn-secondary text-sm py-1 px-2">
              {t("assets.requests.detail.back")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
