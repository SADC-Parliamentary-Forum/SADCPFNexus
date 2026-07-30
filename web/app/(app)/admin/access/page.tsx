"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

type NavChild = { label: string; href: string | null; feature_only?: boolean };
type NavItem = { label: string; href: string | null; children?: NavChild[]; feature_only?: boolean };

export default function AccessGovernanceHomePage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: { items: NavItem[] } }>("/access/navigation").then((r) => r.data)
      .then((res) => setItems(res.data.items ?? []))
      .catch((e) => setError(e?.message ?? "Failed to load navigation"));
  }, []);

  const links = [
    { href: "/admin/access/roles", label: "Role catalogue & builder" },
    { href: "/admin/access/simulator", label: "Access simulator" },
    { href: "/admin/access/explorer", label: "Permission explorer" },
    { href: "/admin/access/requests", label: "Access requests" },
    { href: "/admin/access/reviews", label: "Access review campaigns" },
    { href: "/admin/access/governance", label: "Governance checklist" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Access Governance</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Role catalogue, simulator, explorer, requests and reviews — backend is authoritative.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-[var(--border)] px-4 py-3 hover:bg-[var(--muted)]/40"
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">Effective navigation preview (you)</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.label}>
              {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
              {item.children?.length ? (
                <ul className="ml-4 list-disc">
                  {item.children.map((c) => (
                    <li key={c.label}>
                      {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
                      {c.feature_only ? " (feature-only)" : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
