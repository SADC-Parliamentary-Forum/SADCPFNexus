"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { CORRESPONDENCE_HUB_CARDS } from "@/lib/hubs/correspondence";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "status.draft", cls: "badge-muted" },
  pending_review: { label: "correspondence.status.pendingReview", cls: "badge-warning" },
  pending_approval: { label: "correspondence.status.pendingApproval", cls: "badge-warning" },
  approved: { label: "status.approved", cls: "badge-success" },
  sent: { label: "correspondence.status.sent", cls: "badge-success" },
  pending_sg_routing: { label: "correspondence.status.pendingSgRouting", cls: "badge-warning" },
  in_progress: { label: "correspondence.status.inProgress", cls: "badge-warning" },
  archived: { label: "correspondence.status.archived", cls: "badge-muted" },
};

const typeLabel: Record<string, string> = {
  internal_memo: "correspondence.type.internalMemo",
  external: "correspondence.type.external",
  diplomatic_note: "correspondence.type.diplomaticNote",
  procurement: "nav.procurement",
};

export default function CorrespondencePage() {
  const { t } = useI18n();
  const [letters, setLetters] = useState<CorrespondenceLetter[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      correspondenceApi.list({ per_page: 10 }),
      correspondenceApi.reportSummary().catch(() => ({ data: { data: {} as Record<string, number> } })),
    ])
      .then(([listRes, sumRes]) => {
        setLetters(listRes.data.data ?? []);
        setSummary(sumRes.data.data ?? {});
      })
      .catch(() => setError(t("correspondence.loadFailed")))
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: t("correspondence.status.pendingSgRouting"), value: summary?.incoming_pending_routing ?? 0, href: "/correspondence/pending-routing", icon: "route", color: "text-amber-600", bg: "bg-amber-50" },
    { label: t("correspondence.hub.myOpenActions"), value: summary?.my_open_actions ?? 0, href: "/correspondence/my-actions", icon: "assignment_ind", color: "text-orange-600", bg: "bg-orange-50" },
    { label: t("correspondence.hub.readyForDispatch"), value: summary?.ready_for_dispatch ?? 0, href: "/correspondence/registry?direction=outgoing", icon: "outbox", color: "text-green-600", bg: "bg-green-50" },
    { label: t("correspondence.hub.overdue"), value: summary?.overdue ?? 0, href: "/correspondence/reports", icon: "schedule", color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("correspondence.hub.title")}
        subtitle={t("correspondence.hub.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("workflows.simulate.module.correspondence") }]} />}
        actions={
          <Link href="/correspondence/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            {t("correspondence.hub.new")}
          </Link>
        }
      />

      <ModuleHubCards cards={CORRESPONDENCE_HUB_CARDS} />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{s.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">
                  {loading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-neutral-100" /> : s.value}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[22px]`}>{s.icon}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/correspondence/incoming" className="btn-primary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">move_to_inbox</span>
          {t("correspondence.hub.registerIncoming")}
        </Link>
        <Link href="/correspondence/create" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">edit_square</span>
          {t("correspondence.hub.draftOutgoing")}
        </Link>
        <Link href="/correspondence/master-register" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">menu_book</span>
          {t("correspondence.masterRegister.title")}
        </Link>
        <Link href="/correspondence/subject-files" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">folder_open</span>
          {t("correspondence.subjectFiles.title")}
        </Link>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">mark_email_read</span>
            <h3 className="text-sm font-semibold text-neutral-900">{t("correspondence.hub.recent")}</h3>
          </div>
          <Link href="/correspondence/registry" className="btn-secondary text-xs py-1 px-2">{t("correspondence.hub.viewRegister")}</Link>
        </div>
        <div className="divide-y divide-neutral-100">
          {loading && <div className="p-6 text-center text-sm text-neutral-400">{t("common.loading")}</div>}
          {!loading && letters.length === 0 && (
            <EmptyState icon="mail" title={t("correspondence.hub.empty")} description={t("correspondence.hub.emptyHint")} />
          )}
          {letters.map((l) => {
            const cfg = statusConfig[l.status];
            const st = cfg ? { label: t(cfg.label), cls: cfg.cls } : { label: l.status, cls: "badge-muted" };
            return (
              <Link
                key={l.id}
                href={`/correspondence/${l.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{l.subject}</p>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">
                    {l.registry_reference || l.reference_number || `#${l.id}`} · {typeLabel[l.type] ? t(typeLabel[l.type]) : l.type}
                  </p>
                </div>
                <span className={st.cls}>{st.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
