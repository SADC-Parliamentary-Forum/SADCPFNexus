"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrIncidentsApi, type HrIncident } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

type FilterTab = "all" | "mine" | "open" | "resolved";

const SEVERITY_BADGE: Record<HrIncident["severity"], string> = {
  low: "badge badge-muted",
  medium: "badge badge-warning",
  high: "badge badge-danger",
};

const STATUS_BADGE: Record<HrIncident["status"], string> = {
  reported: "badge badge-warning",
  under_review: "badge badge-primary",
  resolved: "badge badge-success",
  closed: "badge badge-muted",
};

const STATUS_LABEL: Record<HrIncident["status"], string> = {
  reported: "Reported",
  under_review: "Under review",
  resolved: "Resolved",
  closed: "Closed",
};

const SEVERITY_LABEL: Record<HrIncident["severity"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export default function HrIncidentsPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [formError, setFormError] = useState<string | null>(null);

  const queryParams = () => {
    const p: { mine?: "1"; status?: string; per_page: number } = { per_page: 25 };
    if (activeTab === "mine") p.mine = "1";
    if (activeTab === "open") p.status = "reported";
    if (activeTab === "resolved") p.status = "resolved";
    return p;
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["hr-incidents", activeTab],
    queryFn: () => hrIncidentsApi.list(queryParams()),
  });

  const incidents: HrIncident[] =
    (data?.data as unknown as { data?: HrIncident[] })?.data ?? [];

  const mutation = useMutation({
    mutationFn: (payload: { subject: string; description?: string; severity: string }) =>
      hrIncidentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-incidents"] });
      setShowForm(false);
      setSubject("");
      setDescription("");
      setSeverity("medium");
      setFormError(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to submit incident report.";
      setFormError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setFormError("Subject is required.");
      return;
    }
    setFormError(null);
    mutation.mutate({ subject: subject.trim(), description: description.trim() || undefined, severity });
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mine", label: "My Reports" },
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            HR
          </Link>
          <h1 className="page-title">HR Incidents</h1>
          <p className="page-subtitle">Report workplace incidents and track their status.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showForm ? "expand_less" : "add"}
          </span>
          {showForm ? "Cancel" : "Report Incident"}
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="card p-5 border-primary/30 bg-blue-50/30">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">report</span>
            New Incident Report
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">error_outline</span>
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="Brief title describing the incident"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
              <textarea
                rows={3}
                className="form-input resize-none w-full"
                placeholder="Provide full details of the incident…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="max-w-[200px]">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Severity</label>
              <select
                className="form-input w-full"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high")}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !subject.trim()}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
              >
                {mutation.isPending ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`filter-tab${activeTab === tab.key ? " active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load incident reports.
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-5 flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="card p-5 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">report_off</span>
            <p className="mt-3 text-sm text-neutral-500">No incident reports found.</p>
            <p className="text-xs text-neutral-400 mt-1">
              {activeTab !== "all"
                ? "Try switching to the All tab."
                : "Reported incidents will appear here."}
            </p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5">
                      {incident.reference_number}
                    </span>
                    <span className={SEVERITY_BADGE[incident.severity]}>
                      {SEVERITY_LABEL[incident.severity]}
                    </span>
                    <span className={STATUS_BADGE[incident.status]}>
                      {STATUS_LABEL[incident.status]}
                    </span>
                  </div>
                  <p className="font-semibold text-neutral-900 text-sm truncate">{incident.subject}</p>
                  {incident.description && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{incident.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
                    {incident.reporter && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">person</span>
                        {incident.reporter.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                      {formatDateShort(incident.reported_at ?? incident.created_at)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0">
                  <span
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${
                      incident.severity === "high"
                        ? "bg-red-100 text-red-600"
                        : incident.severity === "medium"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {incident.severity === "high"
                        ? "priority_high"
                        : incident.severity === "medium"
                        ? "warning"
                        : "info"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
