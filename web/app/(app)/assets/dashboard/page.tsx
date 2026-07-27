"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

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
    api.get<{ data: Dash }>("/assets/dashboard")
      .then((r) => setData(r.data))
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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fixed Assets Dashboard</h1>
          <p className="page-subtitle">Register health, custody, verification and disposal signals</p>
        </div>
        <Link href="/assets/intake" className="btn btn-primary">Pending intake</Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="card" style={{ padding: "1rem", textDecoration: "none" }}>
            <div className="text-sm text-muted">{c.label}</div>
            <div className="text-2xl font-semibold" style={{ marginTop: 8 }}>
              {data ? data[c.key] : "—"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
