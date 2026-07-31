"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type NavItem = { label: string; href: string | null; children?: Array<{ label: string; href: string | null }> };

export default function MyWorkPage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: { items: NavItem[] } }>("/access/navigation")
      .then((r) => r.data)
      .then((res) => {
        const myWork = (res.data.items ?? []).find((i) => i.label === "My Work");
        setItems(myWork?.children ?? []);
      })
      .catch(() => setError("Could not load My Work features."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="My Work"
        subtitle="Feature-only tasks and assigned work from your effective permissions."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "My Work" }]} />}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="work"
            title="No assigned My Work features"
            description="When you receive feature-only permissions, assigned tasks will appear here."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((c) => (
            <div key={c.label} className="card p-4 transition-colors hover:border-primary/30">
              {c.href ? (
                <Link href={c.href} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <span className="material-symbols-outlined text-[18px] text-primary">assignment</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{c.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">Open assigned work</p>
                  </div>
                  <span className="material-symbols-outlined ml-auto text-[18px] text-neutral-300">chevron_right</span>
                </Link>
              ) : (
                <p className="text-sm font-semibold text-neutral-700">{c.label}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
