"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "badge-muted" },
  pending_review: { label: "Pending Review", cls: "badge-warning" },
  pending_approval: { label: "Pending Approval", cls: "badge-warning" },
  approved: { label: "Approved", cls: "badge-success" },
  signed: { label: "Signed", cls: "badge-success" },
  ready_dispatch: { label: "Ready Dispatch", cls: "badge-success" },
  sent: { label: "Sent", cls: "badge-success" },
  archived: { label: "Archived", cls: "badge-muted" },
  pending_sg_routing: { label: "Pending SG Routing", cls: "badge-warning" },
  routed: { label: "Routed", cls: "badge-warning" },
  in_progress: { label: "In Progress", cls: "badge-warning" },
  voided: { label: "Voided", cls: "badge-muted" },
};

const typeLabel: Record<string, string> = {
  internal_memo: "Memo",
  external: "External",
  diplomatic_note: "Diplomatic",
  procurement: "Procurement",
};

function safeIsoDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function CorrespondenceRegistryPageInner() {
  const searchParams = useSearchParams();
  const [letters, setLetters] = useState<CorrespondenceLetter[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");
  const [filterDir, setFilterDir] = useState(searchParams.get("direction") || "all");

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: 25 };
    if (search) params.search = search;
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterDir !== "all") params.direction = filterDir;

    correspondenceApi
      .list(params)
      .then((res) => {
        setLetters(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, filterStatus, filterDir]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const rows = [
      ["Reference", "Subject", "Type", "Direction", "Status", "Owner", "Created By", "Date"],
      ...letters.map((l) => [
        l.registry_reference || l.reference_number || "",
        l.subject,
        typeLabel[l.type] ?? l.type,
        l.direction,
        l.status,
        l.primary_owner?.name ?? "",
        l.creator?.name ?? "",
        safeIsoDay(l.created_at),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "correspondence-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Correspondence Register</h1>
          <p className="page-subtitle">Incoming and outgoing official correspondence (access-scoped).</p>
        </div>
        <div className="flex gap-2">
          <Link href="/correspondence/incoming" className="btn-secondary text-sm">Register Incoming</Link>
          <Link href="/correspondence/create" className="btn-primary text-sm">Draft Outgoing</Link>
          <button type="button" className="btn-secondary text-sm" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-4">
        <input
          className="form-input sm:col-span-2"
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="form-input"
          value={filterDir}
          onChange={(e) => {
            setFilterDir(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All directions</option>
          <option value="incoming">Incoming</option>
          <option value="outgoing">Outgoing</option>
        </select>
        <select
          className="form-input"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Dir</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">Loading…</td></tr>
            )}
            {!loading && letters.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No records.</td></tr>
            )}
            {letters.map((l) => {
              const st = statusConfig[l.status] ?? { label: l.status, cls: "badge-muted" };
              return (
                <tr key={l.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/correspondence/${l.id}`} className="text-primary hover:underline">
                      {l.registry_reference || l.reference_number || `#${l.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{l.subject}</td>
                  <td className="px-4 py-3">{typeLabel[l.type] ?? l.type}</td>
                  <td className="px-4 py-3 capitalize">{l.direction}</td>
                  <td className="px-4 py-3"><span className={st.cls}>{st.label}</span></td>
                  <td className="px-4 py-3">{l.primary_owner?.name || "—"}</td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{safeIsoDay(l.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>{total} record(s)</span>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} / {lastPage}</span>
          <button type="button" className="btn-secondary text-xs" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

export default function CorrespondenceRegistryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">Loading registry...</div>}>
      <CorrespondenceRegistryPageInner />
    </Suspense>
  );
}