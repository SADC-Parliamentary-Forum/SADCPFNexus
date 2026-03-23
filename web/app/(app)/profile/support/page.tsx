"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportTicketsApi, type SupportTicket } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const PRIORITY_BADGE: Record<SupportTicket["priority"], string> = {
  low: "badge badge-muted",
  medium: "badge badge-warning",
  high: "badge badge-danger",
};

const STATUS_BADGE: Record<SupportTicket["status"], string> = {
  open: "badge badge-warning",
  in_progress: "badge badge-primary",
  resolved: "badge badge-success",
  closed: "badge badge-muted",
};

const STATUS_LABEL: Record<SupportTicket["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_LABEL: Record<SupportTicket["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export default function SupportTicketsPage() {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => supportTicketsApi.list({ per_page: 25 }),
  });

  const tickets: SupportTicket[] =
    (data?.data as unknown as { data?: SupportTicket[] })?.data ?? [];

  const mutation = useMutation({
    mutationFn: (payload: { subject: string; description?: string; priority: string }) =>
      supportTicketsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setShowForm(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
      setFormError(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to submit ticket.";
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
    mutation.mutate({ subject: subject.trim(), description: description.trim() || undefined, priority });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <nav className="flex items-center gap-1 text-xs font-medium text-neutral-500 mb-1">
            <Link href="/profile" className="hover:text-neutral-700">Profile</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Support</span>
          </nav>
          <h1 className="page-title">Help &amp; Support</h1>
          <p className="page-subtitle">Submit a support request to the system administrators.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showForm ? "expand_less" : "add"}
          </span>
          {showForm ? "Cancel" : "New Ticket"}
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="card p-5 border-primary/30 bg-blue-50/30">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">support_agent</span>
            New Support Ticket
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
                placeholder="Briefly describe the issue or request"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
              <textarea
                rows={4}
                className="form-input resize-none w-full"
                placeholder="Provide full details so the support team can help you quickly…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="max-w-[200px]">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Priority</label>
              <select
                className="form-input w-full"
                value={priority}
                onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
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
                {mutation.isPending ? "Submitting…" : "Submit Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load support tickets.
        </div>
      )}

      {/* Ticket list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-5 flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="card p-5 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">confirmation_number</span>
            <p className="mt-3 text-sm text-neutral-500">No support tickets yet.</p>
            <p className="text-xs text-neutral-400 mt-1">
              Submit a ticket above and the admin team will respond shortly.
            </p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5">
                      {ticket.reference_number}
                    </span>
                    <span className={PRIORITY_BADGE[ticket.priority]}>
                      {PRIORITY_LABEL[ticket.priority]}
                    </span>
                    <span className={STATUS_BADGE[ticket.status]}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                  </div>
                  <p className="font-semibold text-neutral-900 text-sm truncate">{ticket.subject}</p>
                  {ticket.description && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{ticket.description}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-xs text-neutral-400">
                    <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                    <span>Submitted {formatDateShort(ticket.created_at)}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  <span
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${
                      ticket.status === "resolved" || ticket.status === "closed"
                        ? "bg-green-100 text-green-600"
                        : ticket.status === "in_progress"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {ticket.status === "resolved" || ticket.status === "closed"
                        ? "check_circle"
                        : ticket.status === "in_progress"
                        ? "sync"
                        : "pending"}
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
