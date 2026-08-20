"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditDashboardPage() {
  const [view, setView] = useState<"auditor" | "management" | "sg">("auditor");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "dashboard", view],
    queryFn: async () => (await auditApi.dashboard(view)).data.data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ModulePageHeader
        title="Audit Management"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Audit Management" }]} />}
      />
        <div className="flex gap-2">
          {(["auditor", "management", "sg"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm rounded border ${view === v ? "bg-neutral-900 text-white" : "bg-white"}`}
            >
              {v === "sg" ? "SG" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading dashboard…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load dashboard.</p>}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(data)
            .filter(([k]) => k !== "role")
            .map(([key, value]) => (
              <div key={key} className="border border-neutral-200 rounded-lg p-4 bg-white">
                <div className="text-xs uppercase tracking-wide text-neutral-500">{key.replaceAll("_", " ")}</div>
                <div className="text-2xl font-semibold mt-2">{String(value)}</div>
              </div>
            ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/audit/analytics", label: "Analytics", icon: "analytics", desc: "Coverage and overdue actions" },
          { href: "/audit/universe", label: "Universe", icon: "public", desc: "Auditable entities" },
          { href: "/audit/plans", label: "Plans", icon: "assignment", desc: "Annual and engagement plans" },
          { href: "/audit/engagements", label: "Engagements", icon: "work", desc: "Active and closed work" },
          { href: "/audit/findings", label: "Findings", icon: "report", desc: "Issues and ratings" },
          { href: "/audit/corrective-actions", label: "Corrective Actions", icon: "rule", desc: "Remediation tracker" },
          { href: "/audit/campaigns", label: "Campaigns", icon: "campaign", desc: "Thematic campaigns" },
          { href: "/audit/resources", label: "Resources", icon: "groups", desc: "Auditor allocation" },
          { href: "/audit/qa", label: "QA Reviews", icon: "verified", desc: "Quality assurance" },
          { href: "/audit/templates", label: "Templates", icon: "description", desc: "Work programmes" },
          { href: "/audit/governance-packs", label: "Governance Packs", icon: "folder_shared", desc: "Committee packs" },
          { href: "/audit/appointments", label: "Appointments", icon: "event", desc: "External appointments" },
          { href: "/audit/external", label: "External Audit", icon: "account_balance", desc: "External engagements" },
          { href: "/audit/ai", label: "AI Assist", icon: "smart_toy", desc: "Drafting support" },
          { href: "/audit/settings", label: "Settings / Charter", icon: "settings", desc: "Mandate and charter" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <span className="material-symbols-outlined mt-0.5 text-primary">{l.icon}</span>
            <span>
              <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">{l.label}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{l.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
