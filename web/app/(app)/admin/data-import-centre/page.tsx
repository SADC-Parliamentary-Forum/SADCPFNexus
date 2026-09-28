"use client";

import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

type ImportEntry = {
  href: string;
  title: string;
  purpose: string;
  icon: string;
  kind: "historical" | "routine";
};

const IMPORT_CENTRE_ENTRIES: ImportEntry[] = [
  {
    href: "/hr/imports",
    title: "HR historical migration",
    purpose: "One-time/corrected historical leave, balances, and payslips from source HR reports (PDF, XLS, XLSX).",
    icon: "history_edu",
    kind: "historical",
  },
  {
    href: "/hr/leave/import",
    title: "Leave — routine import",
    purpose: "Ongoing monthly/period leave requests and balance updates from CSV.",
    icon: "event_available",
    kind: "routine",
  },
  {
    href: "/finance/payroll-imports",
    title: "Payroll — vendor import",
    purpose: "Stage payslip lines from a configured payroll vendor feed.",
    icon: "payments",
    kind: "routine",
  },
  {
    href: "/hr/timesheets/admin/import",
    title: "Timesheets — admin import",
    purpose: "Bulk timesheet entries for staff.",
    icon: "schedule",
    kind: "routine",
  },
  {
    href: "/assets/import",
    title: "Assets — register import",
    purpose: "Bulk asset register upload with preview before commit.",
    icon: "inventory_2",
    kind: "routine",
  },
  {
    href: "/mande/import",
    title: "M&E — data import",
    purpose: "Monitoring & evaluation indicator data import.",
    icon: "insights",
    kind: "routine",
  },
];

export default function DataImportCentrePage() {
  const visible = IMPORT_CENTRE_ENTRIES;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="Data Import Centre"
        subtitle="Every place Nexus accepts a bulk data upload, in one place. Historical/destructive migrations are kept separate from routine ongoing imports."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Data Import Centre" }]} />}
      />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Historical / migration imports</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.filter((e) => e.kind === "historical").map((entry) => (
            <ImportCard key={entry.href} entry={entry} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Routine / ongoing imports</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.filter((e) => e.kind === "routine").map((entry) => (
            <ImportCard key={entry.href} entry={entry} />
          ))}
        </div>
      </section>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">No import destinations are available to your account.</p>
      ) : null}
    </div>
  );
}

function ImportCard({ entry }: { entry: ImportEntry }) {
  return (
    <Link
      href={entry.href}
      className="card flex flex-col gap-2 p-4 transition hover:border-primary hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[18px]">{entry.icon}</span>
        </span>
        <span className="text-sm font-semibold text-neutral-900">{entry.title}</span>
      </div>
      <p className="text-xs text-neutral-500">{entry.purpose}</p>
    </Link>
  );
}
