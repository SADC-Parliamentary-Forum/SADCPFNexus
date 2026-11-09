"use client";

import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
    title: "admin.dataImport.hrHistorical",
    purpose: "admin.dataImport.hrHistoricalDesc",
    icon: "history_edu",
    kind: "historical",
  },
  {
    href: "/hr/leave/import",
    title: "admin.dataImport.leave",
    purpose: "admin.dataImport.leaveDesc",
    icon: "event_available",
    kind: "routine",
  },
  {
    href: "/finance/payroll-imports",
    title: "admin.dataImport.payroll",
    purpose: "admin.dataImport.payrollDesc",
    icon: "payments",
    kind: "routine",
  },
  {
    href: "/hr/timesheets/admin/import",
    title: "admin.dataImport.timesheets",
    purpose: "admin.dataImport.timesheetsDesc",
    icon: "schedule",
    kind: "routine",
  },
  {
    href: "/assets/import",
    title: "admin.dataImport.assets",
    purpose: "admin.dataImport.assetsDesc",
    icon: "inventory_2",
    kind: "routine",
  },
  {
    href: "/mande/import",
    title: "admin.dataImport.mande",
    purpose: "admin.dataImport.mandeDesc",
    icon: "insights",
    kind: "routine",
  },
];

export default function DataImportCentrePage() {
  const { t } = useI18n();
  const visible = IMPORT_CENTRE_ENTRIES;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("admin.dataImport.title")}
        subtitle={t("admin.dataImport.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.homeLabel"), href: "/admin" }, { label: t("admin.dataImport.title") }]} />}
      />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("admin.dataImport.historicalHeading")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.filter((e) => e.kind === "historical").map((entry) => (
            <ImportCard key={entry.href} entry={entry} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("admin.dataImport.routineHeading")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.filter((e) => e.kind === "routine").map((entry) => (
            <ImportCard key={entry.href} entry={entry} />
          ))}
        </div>
      </section>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("admin.dataImport.none")}</p>
      ) : null}
    </div>
  );
}

function ImportCard({ entry }: { entry: ImportEntry }) {
  const { t } = useI18n();
  return (
    <Link
      href={entry.href}
      className="card flex flex-col gap-2 p-4 transition hover:border-primary hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[18px]">{entry.icon}</span>
        </span>
        <span className="text-sm font-semibold text-neutral-900">{t(entry.title)}</span>
      </div>
      <p className="text-xs text-neutral-500">{t(entry.purpose)}</p>
    </Link>
  );
}
