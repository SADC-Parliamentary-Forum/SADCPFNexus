"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "badge-muted" },
  pending_review: { label: "Pending Review", cls: "badge-warning" },
  pending_approval: { label: "Pending Approval", cls: "badge-warning" },
  approved: { label: "Approved", cls: "badge-success" },
  sent: { label: "Sent", cls: "badge-success" },
  pending_sg_routing: { label: "Pending SG Routing", cls: "badge-warning" },
  in_progress: { label: "In Progress", cls: "badge-warning" },
  archived: { label: "Archived", cls: "badge-muted" },
};

const typeLabel: Record<string, string> = {
  internal_memo: "Internal Memo",
  external: "External",
  diplomatic_note: "Diplomatic Note",
  procurement: "Procurement",
};

export default function CorrespondencePage() {
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
      .catch(() => setError("Failed to load correspondence."))
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Pending SG Routing", value: summary?.incoming_pending_routing ?? 0, href: "/correspondence/pending-routing", icon: "route", color: "text-amber-600", bg: "bg-amber-50" },
    { label: "My Open Actions", value: summary?.my_open_actions ?? 0, href: "/correspondence/my-actions", icon: "assignment_ind", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Ready for Dispatch", value: summary?.ready_for_dispatch ?? 0, href: "/correspondence/registry?direction=outgoing", icon: "outbox", color: "text-green-600", bg: "bg-green-50" },
    { label: "Overdue", value: summary?.overdue ?? 0, href: "/correspondence/reports", icon: "schedule", color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Correspondence Register"
        subtitle="Institutional action-and-record register — Registry → SG routing → ownership → dispatch."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Correspondence" }]} />}
        actions={
          <Link href="/correspondence/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            New correspondence
          </Link>
        }
      />

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
          Register Incoming
        </Link>
        <Link href="/correspondence/create" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">edit_square</span>
          Draft Outgoing
        </Link>
        <Link href="/correspondence/master-register" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">menu_book</span>
          Master Register
        </Link>
        <Link href="/correspondence/subject-files" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">folder_open</span>
          Subject Files
        </Link>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">mark_email_read</span>
            <h3 className="text-sm font-semibold text-neutral-900">Recent Correspondence</h3>
          </div>
          <Link href="/correspondence/registry" className="text-xs text-primary hover:underline">View register →</Link>
        </div>
        <div className="divide-y divide-neutral-100">
          {loading && <div className="p-6 text-center text-sm text-neutral-400">Loading…</div>}
          {!loading && letters.length === 0 && (
            <EmptyState icon="mail" title="No correspondence yet" description="Register incoming mail or draft an outgoing letter to get started." />
          )}
          {letters.map((l) => {
            const st = statusConfig[l.status] ?? { label: l.status, cls: "badge-muted" };
            return (
              <Link
                key={l.id}
                href={`/correspondence/${l.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{l.subject}</p>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">
                    {l.registry_reference || l.reference_number || `#${l.id}`} · {typeLabel[l.type] ?? l.type}
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
