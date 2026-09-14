"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorsApi, type SupplierDocumentRecord } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export function SupplierRegisterPanel({ vendorId, canManage }: { vendorId: number; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");

  const docsQuery = useQuery({
    queryKey: ["vendor-register-docs", vendorId],
    queryFn: () => vendorsApi.registerDocuments(vendorId).then((r) => r.data.data),
  });

  const verifyMutation = useMutation({
    mutationFn: (doc: SupplierDocumentRecord) => vendorsApi.verifyDocument(vendorId, doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-register-docs", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: number; remarks: string }) =>
      vendorsApi.rejectDocument(vendorId, id, remarks),
    onSuccess: () => {
      setRejectingId(null);
      setRejectRemarks("");
      queryClient.invalidateQueries({ queryKey: ["vendor-register-docs", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
    },
  });

  const docs = docsQuery.data ?? [];

  return (
    <div className="card overflow-hidden" data-testid="supplier-register-panel">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-800">Document register</h2>
        <p className="text-xs text-neutral-400">Versioned compliance records with officer verification stamps.</p>
      </div>
      {docsQuery.isLoading ? (
        <p className="px-5 py-8 text-sm text-neutral-400">Loading register…</p>
      ) : docs.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-400">No register documents yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-800">{doc.name}</p>
                <p className="text-xs capitalize text-neutral-500">
                  {doc.type_code.replace(/_/g, " ")} · v{doc.version} · {doc.status.replace(/_/g, " ")}
                  {doc.expiry_date ? ` · expires ${formatDateShort(doc.expiry_date)}` : ""}
                </p>
                {doc.verified_at && (
                  <p className="mt-1 text-xs text-green-700" data-testid="document-verify-stamp">
                    Verified {formatDateShort(doc.verified_at)}
                    {doc.verified_by?.name ? ` by ${doc.verified_by.name}` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={vendorsApi.downloadRegisterDocumentUrl(vendorId, doc.id)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  Download
                </a>
                {canManage && doc.status === "pending" && (
                  <>
                    <button
                      type="button"
                      data-testid="verify-document"
                      className="btn-primary text-xs py-1 px-2"
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate(doc)}
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={() => {
                        setRejectingId(doc.id);
                        setRejectRemarks("");
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
              {rejectingId === doc.id && (
                <div className="w-full space-y-2 sm:col-span-2">
                  <textarea
                    className="form-input w-full"
                    rows={2}
                    placeholder="Rejection remarks"
                    value={rejectRemarks}
                    onChange={(e) => setRejectRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={!rejectRemarks.trim() || rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate({ id: doc.id, remarks: rejectRemarks.trim() })}
                  >
                    Confirm reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ActivityTab = "rfqs" | "quotes" | "pos" | "invoices" | string;

export function SupplierChangeRequestsPanel({ vendorId, canManage }: { vendorId: number; canManage: boolean }) {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["vendor-change-requests", vendorId],
    queryFn: () => vendorsApi.changeRequests(vendorId).then((r) => r.data.data),
  });
  const approveMutation = useMutation({
    mutationFn: (id: number) => vendorsApi.approveChangeRequest(vendorId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-change-requests", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (id: number) => vendorsApi.rejectChangeRequest(vendorId, id, "Rejected from Supplier 360"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-change-requests", vendorId] }),
  });

  const rows = listQuery.data ?? [];

  return (
    <div className="card p-6 mt-4" data-testid="supplier-change-requests">
      <h2 className="mb-3 text-sm font-semibold">Critical-field change requests</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No pending or historical change requests.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => {
            const id = Number(row.id);
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2">
                <span>{String(row.field_group ?? "change")} · {String(row.status ?? "")}</span>
                {canManage && row.status === "pending" && (
                  <span className="flex gap-2">
                    <button type="button" className="btn-primary text-xs py-1 px-2" onClick={() => approveMutation.mutate(id)}>Approve</button>
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => rejectMutation.mutate(id)}>Reject</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SupplierActivityPanel({ vendorId, tab }: { vendorId: number; tab: ActivityTab }) {
  const activityQuery = useQuery({
    queryKey: ["vendor-activity", vendorId],
    queryFn: () => vendorsApi.activity(vendorId).then((r) => r.data.data),
  });

  const rows =
    tab === "rfqs"
      ? (activityQuery.data?.rfqs ?? [])
      : tab === "quotes"
        ? (activityQuery.data?.quotes ?? [])
        : tab === "pos"
          ? (activityQuery.data?.purchase_orders ?? [])
          : (activityQuery.data?.invoices ?? []);

  return (
    <div className="card p-6" data-testid={`supplier-360-${tab}`}>
      <h2 className="mb-3 text-sm font-semibold capitalize">{tab === "pos" ? "Purchase orders" : tab}</h2>
      {activityQuery.isLoading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No records in this tab.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row, index) => {
            const item = row as Record<string, unknown>;
            const title =
              String(item.reference_number ?? item.title ?? item.vendor_invoice_number ?? item.id ?? index);
            return (
              <li key={title} className="rounded-lg border border-neutral-100 px-3 py-2">
                {title}
                {item.status ? <span className="ml-2 text-xs text-neutral-500">{String(item.status)}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
