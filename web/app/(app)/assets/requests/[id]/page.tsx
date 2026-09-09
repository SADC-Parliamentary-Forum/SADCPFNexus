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

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "badge-warning" },
  approved: { label: "Approved", badge: "badge-success" },
  rejected: { label: "Rejected", badge: "badge-danger" },
  fulfilled: { label: "Fulfilled", badge: "badge-info" },
};

function padId(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

export default function AssetRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();
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
      setError("This asset request does not exist.");
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
            ? "This asset request does not exist."
            : apiErrorMessage(err, "Failed to load this asset request."),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  const setStatus = async (status: "approved" | "rejected") => {
    if (!request) return;
    const ok = await confirm({
      title: status === "approved" ? "Approve request" : "Reject request",
      message:
        status === "approved"
          ? `Approve ${padId(request.id)}? The requester will see the updated status.`
          : `Reject ${padId(request.id)}? This cannot be undone from the list.`,
      confirmText: status === "approved" ? "Approve" : "Reject",
      variant: status === "rejected" ? "danger" : "primary",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await assetRequestsApi.update(request.id, { status });
      setRequest(res.data);
      success(status === "approved" ? "Request approved." : "Request rejected.");
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not update this request."));
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (!request) return;
    const ok = await confirm({
      title: "Cancel request",
      message: `Permanently cancel ${padId(request.id)}? This cannot be undone.`,
      confirmText: "Cancel request",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await assetRequestsApi.remove(request.id);
      success("Request cancelled.");
      router.push("/assets/requests");
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not cancel this request."));
      setBusy(false);
    }
  };

  const sc = request ? (STATUS_CONFIG[request.status] ?? { label: request.status, badge: "badge-muted" }) : null;

  return (
    <div className="w-full space-y-6">
      <ModulePageHeader
        title={request ? `Asset request ${padId(request.id)}` : "Asset request"}
        subtitle={request?.requester?.name ? `Submitted by ${request.requester.name}` : "Request details"}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Assets", href: "/assets" },
              { label: "Requests", href: "/assets/requests" },
              { label: request ? padId(request.id) : "Request" },
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
                    Approve
                  </button>
                  <button type="button" className="btn-secondary py-2 px-4 text-sm" disabled={busy} onClick={() => void setStatus("rejected")}>
                    Reject
                  </button>
                </>
              ) : null}
              {isOwner ? (
                <button type="button" className="btn-secondary py-2 px-4 text-sm" disabled={busy} onClick={() => void cancelRequest()}>
                  Cancel request
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
            Back to requests
          </Link>
        </div>
      ) : request ? (
        <div className="card p-6 space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reference</dt>
              <dd className="mt-1 font-mono text-sm text-neutral-900">{padId(request.id)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Submitted</dt>
              <dd className="mt-1 text-sm text-neutral-900">{formatDate(request.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Requester</dt>
              <dd className="mt-1 text-sm text-neutral-900">{request.requester?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Email</dt>
              <dd className="mt-1 text-sm text-neutral-900">{request.requester?.email ?? "—"}</dd>
            </div>
          </dl>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Justification</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{request.justification}</p>
          </div>
          <div>
            <Link href="/assets/requests" className="text-sm font-medium text-primary hover:underline">
              Back to requests
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
