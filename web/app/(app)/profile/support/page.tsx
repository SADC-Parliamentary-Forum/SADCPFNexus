"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportTicketsApi, type SupportTicket } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

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

function ticketIsEditable(ticket: SupportTicket): boolean {
  return ticket.status === "open" || ticket.status === "in_progress";
}

export default function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<SupportTicket | null>(null);
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["support-tickets"] });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSubject("");
    setDescription("");
    setPriority("medium");
    setFormError(null);
  };

  const startCreate = () => {
    setEditingId(null);
    setSubject("");
    setDescription("");
    setPriority("medium");
    setFormError(null);
    setViewing(null);
    setShowForm(true);
  };

  const startEdit = (ticket: SupportTicket) => {
    if (!ticketIsEditable(ticket)) {
      toastError("This ticket cannot be edited.", "Resolved or closed tickets are locked.");
      return;
    }
    setEditingId(ticket.id);
    setSubject(ticket.subject);
    setDescription(ticket.description ?? "");
    setPriority(ticket.priority);
    setFormError(null);
    setViewing(null);
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: { subject: string; description?: string; priority: SupportTicket["priority"] }) => {
      if (editingId) {
        return supportTicketsApi.update(editingId, payload);
      }
      return supportTicketsApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      success(editingId ? "Ticket updated." : "Ticket submitted.");
      resetForm();
    },
    onError: (err: unknown) => {
      setFormError(apiErrorMessage(err, "Failed to save ticket."));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: SupportTicket["status"] }) =>
      supportTicketsApi.update(id, { status }),
    onSuccess: (_res, vars) => {
      invalidate();
      success(vars.status === "closed" || vars.status === "resolved" ? "Ticket closed." : "Ticket updated.");
      setViewing((current) => (current && current.id === vars.id ? { ...current, status: vars.status } : current));
    },
    onError: (err: unknown) => {
      toastError("Could not update ticket.", apiErrorMessage(err, "Please try again."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supportTicketsApi.delete(id),
    onSuccess: (_res, id) => {
      invalidate();
      success("Ticket deleted.");
      if (editingId === id) resetForm();
      if (viewing?.id === id) setViewing(null);
    },
    onError: (err: unknown) => {
      toastError("Could not delete ticket.", apiErrorMessage(err, "Please try again."));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setFormError("Subject is required.");
      return;
    }
    setFormError(null);
    saveMutation.mutate({ subject: subject.trim(), description: description.trim() || undefined, priority });
  };

  const handleCloseTicket = async (ticket: SupportTicket) => {
    if (!ticketIsEditable(ticket)) return;
    const ok = await confirm({
      title: "Close ticket",
      message: `Close ${ticket.reference_number}? You will not be able to edit it afterwards.`,
      confirmText: "Close ticket",
    });
    if (!ok) return;
    statusMutation.mutate({ id: ticket.id, status: "closed" });
  };

  const handleDelete = async (ticket: SupportTicket) => {
    const ok = await confirm({
      title: "Delete ticket",
      message: `Delete ${ticket.reference_number}? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    deleteMutation.mutate(ticket.id);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="Help & Support"
        subtitle="Submit a support request to the system administrators."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Profile", href: "/profile" },
              { label: "Support" },
            ]}
          />
        }
        actions={
          <button
            type="button"
            onClick={() => (showForm && !editingId ? resetForm() : startCreate())}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">
              {showForm && !editingId ? "expand_less" : "add"}
            </span>
            {showForm && !editingId ? "Cancel" : "New Ticket"}
          </button>
        }
      />

      {showForm && (
        <div className="card p-5 border-primary/30 bg-blue-50/30">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">
              {editingId ? "edit" : "support_agent"}
            </span>
            {editingId ? "Edit Support Ticket" : "New Support Ticket"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">error_outline</span>
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="support-subject" className="block text-xs font-semibold text-neutral-700 mb-1">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                id="support-subject"
                type="text"
                className="form-input w-full"
                placeholder="Briefly describe the issue or request"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="support-description" className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
              <textarea
                id="support-description"
                rows={4}
                className="form-input resize-none w-full"
                placeholder="Provide full details so the support team can help you quickly…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="max-w-[200px]">
              <label htmlFor="support-priority" className="block text-xs font-semibold text-neutral-700 mb-1">Priority</label>
              <select
                id="support-priority"
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
                onClick={resetForm}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending || !subject.trim()}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Submit Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewing && (
        <div className="card p-5" data-testid="support-ticket-detail">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-neutral-400">{viewing.reference_number}</p>
              <h2 className="text-base font-semibold text-neutral-900 mt-1">{viewing.subject}</h2>
            </div>
            <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={() => setViewing(null)}>
              Close
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={PRIORITY_BADGE[viewing.priority]}>{PRIORITY_LABEL[viewing.priority]}</span>
            <span className={STATUS_BADGE[viewing.status]}>{STATUS_LABEL[viewing.status]}</span>
          </div>
          <p className="text-sm text-neutral-600 mt-3 whitespace-pre-wrap">
            {viewing.description?.trim() || "No description provided."}
          </p>
          <p className="text-xs text-neutral-400 mt-3">Submitted {formatDateShort(viewing.created_at)}</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load support tickets.
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-5 flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon="confirmation_number"
            title="No support tickets yet."
            description="Submit a ticket above and the admin team will respond shortly."
          />
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="card p-5" data-testid="support-ticket-card">
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
                <TicketActionsMenu
                  ticket={ticket}
                  busy={statusMutation.isPending || deleteMutation.isPending}
                  onView={() => { setViewing(ticket); setShowForm(false); }}
                  onEdit={() => startEdit(ticket)}
                  onCloseTicket={() => void handleCloseTicket(ticket)}
                  onDelete={() => void handleDelete(ticket)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TicketActionsMenu({
  ticket,
  busy,
  onView,
  onEdit,
  onCloseTicket,
  onDelete,
}: {
  ticket: SupportTicket;
  busy: boolean;
  onView: () => void;
  onEdit: () => void;
  onCloseTicket: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const editable = ticketIsEditable(ticket);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-50"
        aria-label={`Actions for ${ticket.reference_number}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="support-ticket-actions"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">more_vert</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-neutral-200 bg-white shadow-xl z-50 overflow-hidden py-1"
          >
            <MenuItem testId="support-ticket-action-view" icon="visibility" label="View" onClick={() => run(onView)} />
            <MenuItem testId="support-ticket-action-edit" icon="edit" label="Edit" disabled={!editable} onClick={() => run(onEdit)} />
            <MenuItem testId="support-ticket-action-close" icon="check_circle" label="Close ticket" disabled={!editable} onClick={() => run(onCloseTicket)} />
            <MenuItem testId="support-ticket-action-delete" icon="delete" label="Delete" danger onClick={() => run(onDelete)} />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
  testId,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}
