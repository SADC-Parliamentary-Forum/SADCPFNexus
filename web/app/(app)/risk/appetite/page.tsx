"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { riskApi } from "@/lib/api";

export default function RiskAppetitePage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    riskApi.listAppetitePolicies()
      .then((r) => setPolicies((r.data as any).data ?? []))
      .catch((e) => setError(e?.response?.data?.message ?? "Failed to load appetite policies"));
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="text-sm text-muted-foreground">
        <Link href="/risk" className="hover:text-primary">Risk Register</Link>
        <span className="mx-2">/</span>
        <span>Appetite</span>
      </div>
      <h1 className="page-title">Risk Appetite & Tolerance</h1>
      <p className="page-subtitle">Versioned appetite, tolerance and acceptance authority. Prior versions are retained.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        {policies.map((p) => (
          <div key={p.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{p.title} <span className="text-xs text-muted-foreground">v{p.version}</span></div>
                <div className="text-xs text-muted-foreground mt-1">{p.tolerance_statement}</div>
              </div>
              {p.is_active && <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Active</span>}
            </div>
          </div>
        ))}
        {policies.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">Default policy is created on first access.</p>
        )}
      </div>
    </div>
  );
}
