"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { ASSETS_HUB_CARDS } from "@/lib/hubs/assets";

type Dash = {
  total: number;
  pending: number;
  capital: number;
  controlled: number;
  assigned: number;
  missing: number;
  pending_disposal: number;
  warranty_expiring_30d: number;
};

export default function AssetsDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Dash }>("/assets/dashboard")
      .then((r) => setData(r.data.data))
      .catch(() => setError("Unable to load asset dashboard."));
  }, []);

  const cards: { label: string; key: keyof Dash; href: string }[] = [
    { label: "Total assets", key: "total", href: "/assets" },
    { label: "Pending intake", key: "pending", href: "/assets/intake" },
    { label: "Capital", key: "capital", href: "/assets?asset_class=capital" },
    { label: "Controlled", key: "controlled", href: "/assets?asset_class=controlled" },
    { label: "Assigned", key: "assigned", href: "/assets/mine" },
    { label: "Missing", key: "missing", href: "/assets?status=missing" },
    { label: "Pending disposal", key: "pending_disposal", href: "/assets/disposal" },
    { label: "Warranty ≤30d", key: "warranty_expiring_30d", href: "/assets/maintenance" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Fixed Assets Dashboard"
        subtitle="Register health, custody, verification and disposal signals"
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Assets", href: "/assets" }, { label: "Dashboard" }]} />
        }
        actions={<Link href="/assets/intake" className="btn-primary">Pending intake</Link>}
      />
      <ModuleHubCards cards={ASSETS_HUB_CARDS} />
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="card p-4 transition-colors hover:border-primary/30">
            <div className="text-xs text-neutral-500">{c.label}</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-900">{data ? data[c.key] : "—"}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
