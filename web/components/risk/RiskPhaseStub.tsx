"use client";

import Link from "next/link";

export default function RiskPhaseStubPage({
  title,
  phase,
  blurb,
}: {
  title: string;
  phase: string;
  blurb: string;
}) {
  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href="/risk" className="hover:text-primary">Risk Register</Link>
        <span className="mx-2">/</span>
        <span>{title}</span>
      </div>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{phase} — deferred from Phase 1 scope (§127–§129).</p>
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        {blurb}
      </div>
    </div>
  );
}
