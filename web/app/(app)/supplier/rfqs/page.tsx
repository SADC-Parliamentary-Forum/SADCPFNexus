"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function SupplierRfqsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-rfqs"],
    queryFn: () => supplierPortalApi.rfqs().then((response) => response.data.data),
  });

  if (isLoading) return <div className="card p-6">Loading RFQs...</div>;
  if (isError || !data) return <div className="card p-6">Failed to load RFQs.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">RFQs</h1>
        <p className="page-subtitle">Only RFQs matching your approved supplier categories appear here.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Quote</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-neutral-500">
                  No RFQs available for your approved categories.
                </td>
              </tr>
            ) : (
              data.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="font-mono text-xs text-neutral-600">{invitation.procurement_request?.reference_number}</td>
                  <td>
                    <div className="space-y-1">
                      <p className="font-medium text-neutral-900">{invitation.procurement_request?.title}</p>
                      <div className="flex flex-wrap gap-1">
                        {(invitation.procurement_request?.supplierCategories ?? []).map((category) => (
                          <span key={category.id} className="badge badge-primary">
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-neutral-600">
                    {invitation.procurement_request?.rfq_deadline ? formatDateShort(invitation.procurement_request.rfq_deadline) : "Open"}
                  </td>
                  <td><span className="badge badge-muted">{invitation.status}</span></td>
                  <td className="text-sm text-neutral-600">{invitation.quote ? "Submitted" : "Pending"}</td>
                  <td className="text-right">
                    <Link href={`/supplier/rfqs/${invitation.procurement_request_id}`} className="text-sm text-primary hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
