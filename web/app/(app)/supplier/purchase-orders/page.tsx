"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function SupplierPurchaseOrdersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-purchase-orders"],
    queryFn: () => supplierPortalApi.purchaseOrders().then((response) => response.data.data),
  });

  if (isLoading) return <div className="card p-6">Loading purchase orders...</div>;
  if (isError || !data) return <div className="card p-6">Failed to load purchase orders.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Purchase Orders</h1>
        <p className="page-subtitle">Track issued orders and linked procurement requests.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Request</th>
              <th>Total</th>
              <th>Status</th>
              <th>Issued</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-neutral-500">No purchase orders yet.</td>
              </tr>
            ) : (
              data.map((po) => (
                <tr key={po.id}>
                  <td className="font-mono text-xs text-neutral-600">{po.reference_number}</td>
                  <td>
                    {po.procurement_request ? (
                      <Link href={`/procurement/${po.procurement_request.id}`} className="text-primary hover:underline">
                        {po.procurement_request.reference_number}
                      </Link>
                    ) : "-"}
                  </td>
                  <td>{po.currency} {(po.total_amount ?? 0).toLocaleString()}</td>
                  <td><span className="badge badge-muted">{po.status}</span></td>
                  <td>{po.issued_at ? formatDateShort(po.issued_at) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
