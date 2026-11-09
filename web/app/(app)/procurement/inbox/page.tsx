"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { procurementWorkbenchApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type InboxRow = {
  id: number;
  from_email: string;
  subject: string | null;
  received_at: string | null;
  status: string;
  intake_id: number | null;
};

export default function ProcurementInboxPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "inbox"],
    queryFn: () => procurementWorkbenchApi.inbox().then((r) => r.data),
  });
  const payload = data as {
    data?: { data?: InboxRow[] };
    imap_configured?: boolean;
    note?: string | null;
  };
  const rows = payload?.data?.data ?? [];
  const configured = Boolean(payload?.imap_configured);
  const note = payload?.note?.trim() || null;
  const subtitle = note
    ?? (configured
      ? t("procurement.inbox.subtitleConfigured")
      : t("procurement.inbox.subtitleNotConfigured"));
  const emptyCopy = configured
    ? t("procurement.inbox.emptyConfigured")
    : (note ?? t("procurement.inbox.emptyNotConfigured"));

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("procurement.inbox.title")}
        subtitle={subtitle}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.procurement"), href: "/procurement" }, { label: t("procurement.inbox.crumb") }]} />}
      />
      <p className="text-sm text-neutral-600">
        {t("procurement.inbox.adminHintBefore")}{" "}
        <Link href="/admin/email" className="btn-secondary text-xs py-1 px-2">{t("procurement.inbox.adminLink")}</Link>
        {t("procurement.inbox.adminHintAfter")}
      </p>
      {note && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${configured ? "border-sky-200 bg-sky-50 text-sky-950" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{note}</p>
      )}
      {isLoading && <p className="text-sm text-neutral-500">{t("procurement.inbox.loading")}</p>}
      {isError && <p className="text-sm text-rose-700">{t("procurement.inbox.loadError")}</p>}
      {!isLoading && rows.length === 0 && (
        <div className="card">
          <EmptyState icon="inbox" title={emptyCopy} />
        </div>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{row.subject || t("procurement.inbox.supplierDocument")}</p>
              <p className="text-neutral-600">{row.from_email} · {row.status}</p>
            </div>
            {row.intake_id ? (
              <Link href={`/procurement/from-document?intake=${row.intake_id}`} className="btn-secondary text-xs">{t("procurement.inbox.review")}</Link>
            ) : (
              <span className="text-xs uppercase text-neutral-400">{row.status}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
