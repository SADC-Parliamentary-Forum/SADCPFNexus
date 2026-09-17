"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { contractsApi, type Contract } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

function unwrapList(payload: unknown): Contract[] {
  const data = (payload as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Contract[]) : [];
}

function KpiCard({ label, value, icon, color, bg, href }: {
  label: string; value: number | string; icon: string; color: string; bg: string; href?: string;
}) {
  const inner = (
    <div className={`card p-5 flex items-center gap-3 ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <span className={`material-symbols-outlined text-[22px] ${color}`}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-neutral-900 leading-tight">{value}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function ContractsDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["contracts", "dashboard"],
    queryFn: () => contractsApi.register().then((r) => r.data),
    staleTime: 30_000,
  });

  const items = unwrapList(data);
  const total        = items.length;
  const active       = items.filter((c) => c.status === "active" && !c.is_expired).length;
  const draft        = items.filter((c) => c.status === "draft").length;
  const expiringSoon = items.filter((c) => c.is_expiring_soon).length;
  const expired      = items.filter((c) => c.is_expired).length;
  const totalValue   = items
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Number(c.value || 0), 0);

  const recent = [...items].slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
          title="Contracts"
          subtitle="Institutional contract lifecycle — preparation, approval, signature, performance and close-out"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts" }]} />}
        />
        <div className="flex items-center gap-2">
          <Link href="/contracts/register?new=1" className="btn-primary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Contract
          </Link>
          <Link href="/contracts/register" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            Register
          </Link>
        </div>
      </div>

      {/* Portfolio */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Portfolio</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total Contracts" value={isLoading ? "…" : total} icon="description" color="text-primary" bg="bg-primary/10" href="/contracts/register" />
          <KpiCard label="Active Contracts" value={isLoading ? "…" : active} icon="check_circle" color="text-green-600" bg="bg-green-50" href="/contracts/register?status=active" />
          <KpiCard label="Total Active Value" value={isLoading ? "…" : totalValue.toLocaleString()} icon="payments" color="text-blue-600" bg="bg-blue-50" />
          <KpiCard label="Drafts" value={isLoading ? "…" : draft} icon="edit_note" color="text-neutral-600" bg="bg-neutral-100" href="/contracts/register?status=draft" />
        </div>
      </div>

      {/* Risk */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Risk & Expiry</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Expiring in 30 days" value={isLoading ? "…" : expiringSoon} icon="schedule" color="text-amber-600" bg="bg-amber-50" href="/contracts/register" />
          <KpiCard label="Expired" value={isLoading ? "…" : expired} icon="event_busy" color="text-red-600" bg="bg-red-50" href="/contracts/register" />
        </div>
      </div>

      {/* Recent */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-800">Recent Contracts</h2>
          <Link href="/contracts/register" className="text-xs text-primary">View register →</Link>
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-neutral-500">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-5 text-sm text-neutral-500">No contracts yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Reference</th><th>Title</th><th>Counterparty</th><th className="text-right">Value</th><th>End Date</th></tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/contracts/${c.id}`} className="font-mono text-xs text-primary">{c.reference_number}</Link></td>
                  <td className="text-sm font-medium text-neutral-800 max-w-[220px] truncate">{c.title}</td>
                  <td className="text-sm text-neutral-600">{c.vendor?.name ?? "—"}</td>
                  <td className="text-right text-sm font-semibold text-neutral-900">{c.currency} {Number(c.value).toLocaleString()}</td>
                  <td className="text-sm text-neutral-500">{c.end_date ? formatDateShort(c.end_date) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
