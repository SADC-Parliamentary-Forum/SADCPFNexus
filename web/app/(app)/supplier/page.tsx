"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";

function statusLabel(status?: string): string {
  return (status ?? "draft").replace(/_/g, " ");
}

export default function SupplierDashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-dashboard"],
    queryFn: () => supplierPortalApi.dashboard().then((response) => response.data.data),
  });
  const submitMutation = useMutation({
    mutationFn: () => supplierPortalApi.submitApplication(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] }),
  });

  if (isLoading) return <div className="card p-6">Loading supplier dashboard...</div>;
  if (isError || !data) return <div className="card p-6">Failed to load supplier dashboard.</div>;

  const actions = data.actions ?? [];

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Supplier Portal"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Supplier Portal" }]} />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5" data-testid="supplier-status">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Registration status</p>
          <p className="mt-2 text-xl font-bold capitalize text-neutral-900">{statusLabel(data.status ?? data.vendor.status)}</p>
        </div>
        <div className="card p-5" data-testid="supplier-completeness">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Profile completeness</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{data.completeness_percent ?? data.vendor.completeness?.percent ?? 0}%</p>
        </div>
        <div className="card p-5" data-testid="supplier-compliance">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Compliance</p>
          <p className="mt-2 text-xl font-bold capitalize text-neutral-900">{data.compliance_status ?? data.eligibility?.compliance_status ?? "unknown"}</p>
        </div>
      </div>

      <div className="card p-5 space-y-3" data-testid="supplier-actions">
        <h2 className="text-sm font-bold text-neutral-800">Action list</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-neutral-500">No outstanding actions. Review open RFQs when invitations arrive.</p>
        ) : (
          <ul className="space-y-2">
            {actions.map((action) => (
              <li key={`${action.code}-${action.label}`}>
                {action.code === "submit_application" ? (
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                  >
                    {action.label}
                  </button>
                ) : (
                  <Link href={action.href} className="text-sm text-primary hover:underline">
                    {action.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/supplier/rfqs" className="btn-secondary text-sm py-1 px-2">RFQs ({data.open_rfq_count})</Link>
        <Link href="/supplier/purchase-orders" className="btn-secondary text-sm py-1 px-2">Purchase orders ({data.purchase_order_count})</Link>
        <Link href="/supplier/invoices" className="btn-secondary text-sm py-1 px-2">Invoices ({data.invoice_count})</Link>
        <Link href="/supplier/profile" className="btn-secondary text-sm py-1 px-2">Profile and documents</Link>
      </div>
    </div>
  );
}
