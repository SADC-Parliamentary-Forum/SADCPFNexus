"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { ASSETS_HUB_CARDS } from "@/lib/hubs/assets";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Dash = {
  total: number;
  live: number;
  pending: number;
  active: number;
  retired: number;
  disposed: number;
  capital: number;
  controlled: number;
  assigned: number;
  missing: number;
  pending_disposal: number;
  warranty_expiring_30d: number;
  in_service?: number;
  available?: number;
  storage?: number;
  under_repair?: number;
  checked_out?: number;
  stolen?: number;
  lost?: number;
  not_verified?: number;
  labels_reprint_required?: number;
  unassigned?: number;
  no_location?: number;
  no_label?: number;
  replacement_due?: number;
  total_acquisition_cost?: number;
  total_book_value?: number;
  pending_handovers?: number;
  disputed_handovers?: number;
  unlabeled?: number;
  unassigned_from_batch?: number;
};

export default function AssetsDashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Dash }>("/assets/dashboard")
      .then((r) => setData(r.data.data))
      .catch(() => setError(t("assets.dash.loadFailed")));
  }, [t]);

  const cards: { label: string; key: keyof Dash; href: string }[] = [
    { label: "Total assets", key: "total", href: "/assets" },
    { label: t("assets.dash.inService"), key: "in_service", href: "/assets?status=live" },
    { label: t("assets.dash.available"), key: "available", href: "/assets?status=available" },
    { label: t("assets.dash.storage"), key: "storage", href: "/assets" },
    { label: t("assets.dash.underRepair"), key: "under_repair", href: "/assets/maintenance" },
    { label: t("assets.dash.checkedOut"), key: "checked_out", href: "/assets/checkouts" },
    { label: t("assets.dash.stolen"), key: "stolen", href: "/assets/incidents" },
    { label: t("assets.dash.lost"), key: "lost", href: "/assets/incidents" },
    { label: t("assets.dash.notVerified"), key: "not_verified", href: "/assets/verification" },
    { label: t("assets.dash.reprint"), key: "labels_reprint_required", href: "/assets/labels" },
    { label: t("assets.dash.pendingHandovers"), key: "pending_handovers", href: "/assets/handovers" },
    { label: t("assets.dash.disputed"), key: "disputed_handovers", href: "/assets/handovers" },
    { label: t("assets.dash.unlabeled"), key: "unlabeled", href: "/assets/labels" },
    { label: t("assets.dash.unassignedFromBatch"), key: "unassigned_from_batch", href: "/assets/batches" },
    { label: t("assets.dash.unassigned"), key: "unassigned", href: "/assets?status=available" },
    { label: t("assets.dash.noLocation"), key: "no_location", href: "/assets" },
    { label: t("assets.dash.noLabel"), key: "no_label", href: "/assets/labels" },
    { label: t("assets.dash.replacementDue"), key: "replacement_due", href: "/assets/reports" },
    { label: "Pending intake", key: "pending", href: "/assets/intake" },
    { label: "Capital", key: "capital", href: "/assets?asset_class=capital" },
    { label: "Controlled", key: "controlled", href: "/assets?asset_class=controlled" },
    { label: "Warranty ≤30d", key: "warranty_expiring_30d", href: "/assets/maintenance" },
  ];
  if (data && data.total_acquisition_cost != null) {
    cards.push({ label: t("assets.dash.acquisitionCost"), key: "total_acquisition_cost", href: "/assets/reports" });
    cards.push({ label: t("assets.dash.bookValue"), key: "total_book_value", href: "/assets/reports" });
  }

  return (
    <div className="w-full min-w-0 space-y-5">
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
