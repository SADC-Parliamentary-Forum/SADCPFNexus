"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportTicketsApi, type SupportTicket } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { accountProfilePath } from "@/lib/postAuthDestination";
import { runAfterOverlayClose } from "@/lib/run-after-overlay-close";
import { readStoredUser } from "@/lib/session";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  open: "profile.support.status.open",
  in_progress: "profile.support.status.inProgress",
  resolved: "hr.incidents.status.resolved",
  closed: "hr.incidents.status.closed",
};

const PRIORITY_LABEL: Record<SupportTicket["priority"], string> = {
  low: "hr.incidents.severity.low",
  medium: "hr.incidents.severity.medium",
  high: "hr.incidents.severity.high",
};

function ticketIsEditable(ticket: SupportTicket): boolean {
  return ticket.status === "open" || ticket.status === "in_progress";
}

const TICKET_MENU_WIDTH = 192;
const TICKET_MENU_HEIGHT = 184;

export default function SupportTicketsPage() {
  const { t } = useI18n();
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
  const [profileHref, setProfileHref] = useState("/profile");

  useEffect(() => {
    setProfileHref(accountProfilePath(readStoredUser()));
  }, []);

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
      toastError(t("profile.support.notEditable"), t("profile.support.notEditableHint"));
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
      success(editingId ? t("profile.support.updated") : t("profile.support.submitted"));
      resetForm();
    },
    onError: (err: unknown) => {
      setFormError(apiErrorMessage(err, t("profile.support.saveFailed")));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: SupportTicket["status"] }) =>
      supportTicketsApi.update(id, { status }),
    onSuccess: (_res, vars) => {
      invalidate();
      success(vars.status === "closed" || vars.status === "resolved" ? t("profile.support.closed") : t("profile.support.updated"));
      setViewing((current) => (current && current.id === vars.id ? { ...current, status: vars.status } : current));
    },
    onError: (err: unknown) => {
      toastError(t("profile.support.updateFailed"), apiErrorMessage(err, t("profile.support.tryAgain")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supportTicketsApi.delete(id),
    onSuccess: (_res, id) => {
      invalidate();
      success(t("profile.support.deleted"));
      if (editingId === id) resetForm();
      if (viewing?.id === id) setViewing(null);
    },
    onError: (err: unknown) => {
      toastError(t("profile.support.deleteFailed"), apiErrorMessage(err, t("profile.support.tryAgain")));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setFormError(t("profile.support.subjectRequired"));
      return;
    }
    setFormError(null);
    saveMutation.mutate({ subject: subject.trim(), description: description.trim() || undefined, priority });
  };

  const handleCloseTicket = async (ticket: SupportTicket) => {
    if (!ticketIsEditable(ticket)) return;
    const ok = await confirm({
      title: t("profile.support.closeTicket"),
      message: t("profile.support.closeMessage", { reference: ticket.reference_number }),
      confirmText: t("profile.support.closeTicket"),
    });
    if (!ok) return;
    statusMutation.mutate({ id: ticket.id, status: "closed" });
  };

  const handleDelete = async (ticket: SupportTicket) => {
    const ok = await confirm({
      title: t("profile.support.deleteTitle"),
      message: t("profile.support.deleteMessage", { reference: ticket.reference_number }),
      confirmText: t("common.delete"),
      variant: "danger",
    });
    if (!ok) return;
    deleteMutation.mutate(ticket.id);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="nav.help"
        subtitle="profile.support.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "profile.signature.crumbProfile", href: profileHref },
              { label: "profile.support.crumb" },
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
            {showForm && !editingId ? t("common.cancel") : t("profile.support.newTicket")}
          </button>
        }
      />

      {showForm && (
        <div className="card p-5 border-primary/30 bg-blue-50/30">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">
              {editingId ? "edit" : "support_agent"}
            </span>
            {editingId ? t("profile.support.editTitle") : t("profile.support.newTitle")}
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
                {t("hr.incidents.new.subject")} <span className="text-red-500">*</span>
              </label>
              <input
                id="support-subject"
                type="text"
                className="form-input w-full"
                placeholder={t("profile.support.subjectPlaceholder")}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="support-description" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.timesheets.templates.description")}</label>
              <textarea
                id="support-description"
                rows={4}
                className="form-input resize-none w-full"
                placeholder={t("profile.support.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="max-w-[200px]">
              <label htmlFor="support-priority" className="block text-xs font-semibold text-neutral-700 mb-1">{t("profile.support.priority")}</label>
              <select
                id="support-priority"
                className="form-input w-full"
                value={priority}
                onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
              >
                <option value="low">{t("hr.incidents.severity.low")}</option>
                <option value="medium">{t("hr.incidents.severity.medium")}</option>
                <option value="high">{t("hr.incidents.severity.high")}</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary px-4 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending || !subject.trim()}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? t("hr.timesheets.saving")
                  : editingId
                    ? t("hr.timesheets.templates.saveChanges")
                    : t("profile.support.submitTicket")}
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
            <div className="flex items-center gap-2 shrink-0">
              {ticketIsEditable(viewing) && (
                <button
                  type="button"
                  className="btn-primary py-1 px-2 text-xs"
                  data-testid="support-ticket-detail-close"
                  onClick={() => void handleCloseTicket(viewing)}
                >
                  {t("profile.support.closeTicket")}
                </button>
              )}
              <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={() => setViewing(null)}>
                {t("profile.support.dismiss")}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={PRIORITY_BADGE[viewing.priority]}>{t(PRIORITY_LABEL[viewing.priority])}</span>
            <span className={STATUS_BADGE[viewing.status]}>{t(STATUS_LABEL[viewing.status])}</span>
          </div>
          <p className="text-sm text-neutral-600 mt-3 whitespace-pre-wrap">
            {viewing.description?.trim() || t("profile.support.noDescription")}
          </p>
          <p className="text-xs text-neutral-400 mt-3">{t("profile.support.submittedOn", { date: formatDateShort(viewing.created_at) })}</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {t("profile.support.loadFailed")}
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-5 flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">{t("common.loading")}</span>
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon="confirmation_number"
            title={t("profile.support.empty")}
            description={t("profile.support.emptyHint")}
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
                      {t(PRIORITY_LABEL[ticket.priority])}
                    </span>
                    <span className={STATUS_BADGE[ticket.status]}>
                      {t(STATUS_LABEL[ticket.status])}
                    </span>
                  </div>
                  <p className="font-semibold text-neutral-900 text-sm truncate">{ticket.subject}</p>
                  {ticket.description && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{ticket.description}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-xs text-neutral-400">
                    <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                    <span>{t("profile.support.submittedOn", { date: formatDateShort(ticket.created_at) })}</span>
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const editable = ticketIsEditable(ticket);

  const run = (action: () => void) => {
    runAfterOverlayClose(() => setOpen(false), action);
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < TICKET_MENU_HEIGHT + 8 && rect.top > TICKET_MENU_HEIGHT + 8;
    const top = openUp ? Math.max(8, rect.top - TICKET_MENU_HEIGHT - 4) : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - TICKET_MENU_WIDTH),
      window.innerWidth - TICKET_MENU_WIDTH - 8,
    );
    setMenuPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-50"
        aria-label={t("profile.support.actionsFor", { reference: ticket.reference_number })}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="support-ticket-actions"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">more_vert</span>
      </button>
      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200]"
              data-testid="support-ticket-actions-backdrop"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              data-testid="support-ticket-actions-menu"
              className="fixed z-[210] w-48 rounded-xl border border-neutral-200 bg-white shadow-xl overflow-hidden py-1"
              style={menuPos ? { top: menuPos.top, left: menuPos.left } : { top: 0, left: 0, visibility: "hidden" }}
            >
              <MenuItem testId="support-ticket-action-view" icon="visibility" label="profile.support.menu.view" onClick={() => run(onView)} />
              <MenuItem testId="support-ticket-action-edit" icon="edit" label="common.edit" disabled={!editable} onClick={() => run(onEdit)} />
              <MenuItem testId="support-ticket-action-close" icon="check_circle" label="profile.support.closeTicket" disabled={!editable} onClick={() => run(onCloseTicket)} />
              <MenuItem testId="support-ticket-action-delete" icon="delete" label="common.delete" danger onClick={() => run(onDelete)} />
            </div>
          </>,
          document.body,
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
  const { t } = useI18n();
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
      {t(label)}
    </button>
  );
}
