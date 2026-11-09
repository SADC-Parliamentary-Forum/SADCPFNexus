"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { assignmentsApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssignmentHandoverPage() {
  const { t } = useI18n();
  const me = getStoredUser();
  const [q, setQ] = useState("overdue high mine");
  const pack = useQuery({
    queryKey: ["assignments-handover", me?.id],
    enabled: Boolean(me?.id),
    queryFn: () => assignmentsApi.handoverPack({ from_user_id: Number(me?.id) }).then((r) => r.data.data),
  });
  const suggest = useQuery({
    queryKey: ["assignments-nl", q],
    queryFn: () => assignmentsApi.nlSearch(q).then((r) => r.data.data),
    enabled: false,
  });

  const open = (pack.data?.open_assignments ?? []) as Array<Record<string, unknown>>;
  const applyHrefs = (suggest.data?.apply_hrefs ?? []) as Array<{ label: string; href: string }>;
  const docxHref = me?.id ? assignmentsApi.handoverPackDocxUrl({ from_user_id: Number(me.id) }) : null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
          title={t("assignments.handover.title")}
          subtitle={t("assignments.handover.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.assignments"), href: "/assignments" }, { label: t("assignments.handover.breadcrumb") }]} />}
        />
        {docxHref ? (
          <a className="btn-secondary text-sm" data-testid="handover-pack-docx" href={docxHref}>
            {t("assignments.handover.downloadWord")}
          </a>
        ) : null}
      </div>

      <form
        className="card flex flex-wrap gap-2 p-4"
        data-testid="assignment-nl-search"
        onSubmit={(e) => {
          e.preventDefault();
          void suggest.refetch();
        }}
      >
        <input className="form-input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("assignments.handover.searchPlaceholder")} />
        <button type="submit" className="btn-secondary text-sm">{t("assignments.handover.suggest")}</button>
      </form>
      {suggest.data && (
        <div className="card space-y-3 p-4 text-sm">
          <p className="text-neutral-600">{String(suggest.data.note ?? t("assignments.handover.suggestionsOnly"))}</p>
          <LabelledRecord value={suggest.data.suggested_filters} />
          <div className="flex flex-wrap gap-2" data-testid="assignment-nl-apply-hrefs">
            {applyHrefs.map((row) => (
              <Link key={row.href} href={row.href} className="btn-secondary text-sm">
                {row.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {pack.isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
      <div className="card overflow-x-auto" data-testid="assignment-handover-pack">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="p-2">{t("assignments.handover.colTitle")}</th>
              <th className="p-2">{t("assignments.handover.colStatus")}</th>
              <th className="p-2">{t("assignments.handover.colDue")}</th>
              <th className="p-2">{t("assignments.handover.colEstHours")}</th>
              <th className="p-2">{t("assignments.handover.colLoggedHours")}</th>
            </tr>
          </thead>
          <tbody>
            {open.map((row) => (
              <tr key={String(row.id)} className="border-t border-neutral-200">
                <td className="p-2">
                  <Link className="font-medium text-primary" href={`/assignments/${row.id}`}>
                    {String(row.title)}
                  </Link>
                </td>
                <td className="p-2">{String(row.status)}</td>
                <td className="p-2">{String(row.due_date ?? "—")}</td>
                <td className="p-2">{String(row.estimated_hours ?? "—")}</td>
                <td className="p-2">{String(row.logged_hours ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
