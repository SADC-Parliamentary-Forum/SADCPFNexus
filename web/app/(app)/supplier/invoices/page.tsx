"use client";

import { useQuery } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function SupplierInvoicesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-invoices"],
    queryFn: () => supplierPortalApi.invoices().then((response) => response.data.data),
  });

  if (isLoading) return <div className="card p-6">Loading invoices...</div>;
  if (isError || !data) return <div className="card p-6">Failed to load invoices.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Invoices</h1>
        <p className="page-subtitle">Monitor invoice matching, approval, and payment status.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Vendor Invoice</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-neutral-500">No invoices submitted yet.</td>
              </tr>
            ) : (
              data.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-mono text-xs text-neutral-600">{invoice.reference_number}</td>
                  <td>{invoice.vendor_invoice_number}</td>
                  <td>{invoice.currency} {(invoice.amount ?? 0).toLocaleString()}</td>
                  <td><span className="badge badge-muted">{invoice.status}</span></td>
                  <td>{invoice.due_date ? formatDateShort(invoice.due_date) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
