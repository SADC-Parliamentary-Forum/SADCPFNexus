"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";

type NavChild = { label: string; href: string | null; feature_only?: boolean };
type NavItem = { label: string; href: string | null; children?: NavChild[]; feature_only?: boolean };

const LINKS = [
  { href: "/admin/access/roles", label: "Role catalogue & builder", icon: "badge", description: "Versioned role templates" },
  { href: "/admin/access/simulator", label: "Access simulator", icon: "science", description: "Preview effective permissions" },
  { href: "/admin/access/explorer", label: "Permission explorer", icon: "manage_search", description: "Trace permission holders" },
  { href: "/admin/access/requests", label: "Access requests", icon: "how_to_reg", description: "Request and decide grants" },
  { href: "/admin/access/reviews", label: "Access review campaigns", icon: "fact_check", description: "Periodic access attestation" },
  { href: "/admin/access/governance", label: "Governance checklist", icon: "policy", description: "Institutional decisions" },
];

export default function AccessGovernanceHomePage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: { items: NavItem[] } }>("/access/navigation")
      .then((r) => r.data)
      .then((res) => setItems(res.data.items ?? []))
      .catch((e) => setError(e?.message ?? "Failed to load navigation"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Access Governance"
        subtitle="Role catalogue, simulator, explorer, requests and reviews — backend is authoritative."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Access Governance" }]} />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-start gap-3 p-4 transition-colors hover:border-primary/30">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-[18px] text-primary">{l.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{l.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{l.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <FormSection title="Effective navigation preview" description="What you can currently see based on effective permissions." icon="account_tree">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="menu" title="No navigation items" description="Your effective permissions returned an empty navigation tree." />
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.label} className="rounded-lg border border-neutral-100 px-3 py-2">
                {item.href ? (
                  <Link href={item.href} className="font-medium text-primary hover:underline">
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
                          <Link href={c.href} className="hover:text-primary hover:underline">
                            {c.label}
                          </Link>
                        ) : (
                          c.label
                        )}
                        {c.feature_only ? <span className="ml-1.5 badge badge-muted text-[10px]">feature-only</span> : null}
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
