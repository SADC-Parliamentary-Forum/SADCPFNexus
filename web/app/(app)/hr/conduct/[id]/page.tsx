"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { conductApi, type ConductRecord } from "@/lib/api";

const RECORD_TYPE_LABELS: Record<string, string> = {
  commendation: "Commendation",
  verbal_counseling: "Verbal counseling",
  written_warning: "Written warning",
  final_warning: "Final warning",
  suspension: "Suspension",
  dismissal: "Dismissal",
  performance_improvement: "Performance improvement",
};

const RECORD_TYPE_CLS: Record<string, string> = {
  commendation: "bg-green-100 text-green-800 border-green-200",
  verbal_counseling: "bg-amber-100 text-amber-800 border-amber-200",
  written_warning: "bg-orange-100 text-orange-800 border-orange-200",
  final_warning: "bg-red-100 text-red-800 border-red-200",
  suspension: "bg-red-100 text-red-800 border-red-200",
  dismissal: "bg-red-100 text-red-800 border-red-200",
  performance_improvement: "bg-blue-100 text-blue-800 border-blue-200",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  under_appeal: "Under appeal",
  resolved: "Resolved",
  closed: "Closed",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ConductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? Number(params.id) : NaN;
  const [record, setRecord] = useState<ConductRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      router.replace("/hr/conduct");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await conductApi.get(id);
      setRecord(res.data);
    } catch {
      setError("Failed to load record.");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-center py-20 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span className="ml-2">Loading record…</span>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Not found"}
        </div>
        <Link href="/hr/conduct" className="text-sm font-semibold text-primary hover:underline">
          Back to Conduct & Recognition
        </Link>
      </div>
    );
  }

  const recordedByName = record.recorded_by?.name ?? (record.recorded_by_id ? `#${record.recorded_by_id}` : "—");

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
          HR
        </Link>
        <Link href="/hr/conduct" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 block">
          Conduct & Recognition
        </Link>
        <h1 className="page-title">{record.title}</h1>
        <p className="page-subtitle">
          {record.employee?.name ?? `Employee #${record.employee_id}`}
          {" · "}
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RECORD_TYPE_CLS[record.record_type] ?? ""}`}>
            {RECORD_TYPE_LABELS[record.record_type] ?? record.record_type}
          </span>
        </p>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-neutral-500">Status</span>
          <span className="text-sm font-medium text-neutral-700">
            {STATUS_LABELS[record.status] ?? record.status}
          </span>
        </div>
        <div className="text-sm text-neutral-600">
          Issue date: {formatDate(record.issue_date)}
        </div>
        {record.incident_date && (
          <div className="text-sm text-neutral-600">
            Incident date: {formatDate(record.incident_date)}
          </div>
        )}
        {record.resolution_date && (
          <div className="text-sm text-neutral-600">
            Resolution: {formatDate(record.resolution_date)}
          </div>
        )}
        <div className="text-sm text-neutral-600">
          Recorded by: {recordedByName}
        </div>
        {record.is_confidential && (
          <span className="badge badge-warning">Confidential</span>
        )}
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Description</h2>
        <p className="text-sm text-neutral-700 whitespace-pre-wrap">{record.description}</p>
      </div>

      {record.outcome && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">Outcome</h2>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{record.outcome}</p>
        </div>
      )}

      {record.appeal_notes && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">Appeal notes</h2>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{record.appeal_notes}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Link href="/hr/conduct" className="text-sm font-semibold text-primary hover:underline">
          Back to Conduct & Recognition
        </Link>
      </div>
    </div>
  );
}
