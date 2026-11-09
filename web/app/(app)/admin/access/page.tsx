"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type NavChild = { label: string; href: string | null; feature_only?: boolean };
type NavItem = { label: string; href: string | null; children?: NavChild[]; feature_only?: boolean };

const LINKS = [
  { href: "/admin/access/roles", label: "admin.access.links.roles", icon: "badge", description: "admin.access.links.rolesDesc" },
  { href: "/admin/access/simulator", label: "admin.access.links.simulator", icon: "science", description: "admin.access.links.simulatorDesc" },
  { href: "/admin/access/explorer", label: "admin.access.explorer.title", icon: "manage_search", description: "admin.access.links.explorerDesc" },
  { href: "/admin/access/requests", label: "admin.access.links.requests", icon: "how_to_reg", description: "admin.access.links.requestsDesc" },
  { href: "/admin/access/reviews", label: "admin.access.links.reviews", icon: "fact_check", description: "admin.access.links.reviewsDesc" },
  { href: "/admin/access/governance", label: "admin.access.links.governance", icon: "policy", description: "admin.access.links.governanceDesc" },
  { href: "/admin/access/cutover", label: "admin.access.links.cutover", icon: "sync_lock", description: "admin.access.links.cutoverDesc" },
];

export default function AccessGovernanceHomePage() {
  const { t } = useI18n();
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: { items: NavItem[] } }>("/access/navigation")
      .then((r) => r.data)
      .then((res) => setItems(res.data.items ?? []))
      .catch((e) => setError(e?.message ?? t("admin.access.navLoadFailed")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("admin.access.title")}
        subtitle={t("admin.access.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("admin.homeLabel"), href: "/admin" }, { label: t("admin.access.title") }]} />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-start gap-3 p-4 transition-colors hover:border-primary/30">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-[18px] text-primary">{l.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{t(l.label)}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{t(l.description)}</p>
            </div>
          </Link>
        ))}
      </div>

      <FormSection title={t("admin.access.navPreview")} description={t("admin.access.navPreviewDesc")} icon="account_tree">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="menu" title={t("admin.access.navEmpty")} description={t("admin.access.navEmptyDesc")} />
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.label} className="rounded-lg border border-neutral-100 px-3 py-2">
                {item.href ? (
                  <Link href={item.href} className="font-medium text-primary">
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium text-neutral-800">{item.label}</span>
                )}
                {item.children?.length ? (
                  <ul className="mt-1.5 space-y-1 border-l border-neutral-200 pl-3 text-xs text-neutral-600">
                    {item.children.map((c) => (
                      <li key={c.label}>
                        {c.href ? (
                          <Link href={c.href} className="hover:text-primary">
                            {c.label}
                          </Link>
                        ) : (
                          c.label
                        )}
                        {c.feature_only ? <span className="ml-1.5 badge badge-muted text-[10px]">{t("admin.access.featureOnly")}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
