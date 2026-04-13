"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";

export default function SupplierDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-dashboard"],
    queryFn: () => supplierPortalApi.dashboard().then((response) => response.data.data),
  });

  if (isLoading) return <div className="card p-6">Loading supplier dashboard...</div>;
  if (isError || !data) return <div className="card p-6">Failed to load supplier dashboard.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Supplier Portal</h1>
        <p className="page-subtitle">
          {data.vendor.name} {data.vendor.status ? `| ${data.vendor.status.replace("_", " ")}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Open RFQs", data.open_rfq_count, "/supplier/rfqs"],
          ["Quotes", data.quote_count, "/supplier/rfqs"],
          ["Purchase Orders", data.purchase_order_count, "/supplier/purchase-orders"],
          ["Invoices", data.invoice_count, "/supplier/invoices"],
        ].map(([label, value, href]) => (
          <Link key={String(label)} href={String(href)} className="card p-5 block hover:border-primary/30">
            <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-neutral-900">{value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-neutral-800">Approved Categories</h2>
          <div className="flex flex-wrap gap-2">
            {(data.vendor.categories ?? []).length > 0 ? (
              (data.vendor.categories ?? []).map((category) => (
                <span key={category.id} className="badge badge-primary">
                  {category.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-neutral-500">No approved categories assigned yet.</span>
            )}
          </div>
          {data.vendor.last_info_request_reason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {data.vendor.last_info_request_reason}
            </div>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-neutral-800">Next Steps</h2>
          <Link href="/supplier/rfqs" className="block text-sm text-primary hover:underline">
            Review and respond to RFQs
          </Link>
          <Link href="/supplier/purchase-orders" className="block text-sm text-primary hover:underline">
            Track issued purchase orders
          </Link>
          <Link href="/supplier/profile" className="block text-sm text-primary hover:underline">
            Update supplier profile and documents
          </Link>
        </div>
      </div>
    </div>
  );
}
