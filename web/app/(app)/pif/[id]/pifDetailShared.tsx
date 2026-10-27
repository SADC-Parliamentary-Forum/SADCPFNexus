// Presentation constants and dialog chrome for the PIF detail page.
import type { ReactNode } from "react";
import type { ProgrammeAttachmentType } from "@/lib/api";

// ─── Status helpers ───────────────────────────────────────────────────────────
export const STATUS_BADGE: Record<string, string> = {
  draft: "badge-muted",
  submitted: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
  active: "badge-primary",
  on_hold: "badge-warning",
  completed: "badge-success",
  financially_closed: "badge-muted",
  archived: "badge-muted",
  amended: "badge-success",
  amendment_draft: "badge-muted",
  amendment_pending_approval: "badge-warning",
  superseded: "badge-muted",
};
export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected", active: "Active",
  on_hold: "On Hold", completed: "Completed", financially_closed: "Fin. Closed", archived: "Archived",
  amended: "Amended", amendment_draft: "Amendment Draft",
  amendment_pending_approval: "Amendment Pending Approval", superseded: "Superseded",
};
export const ME_STATUS_LABEL: Record<string, string> = {
  not_yet_linked: "Not Yet Linked",
  linked_record_archived: "Linked Record Archived",
  report_pending: "Report Pending",
  report_submitted: "Report Submitted",
  returned_for_correction: "Returned for Correction",
  me_reviewed: "M&E Reviewed",
  accepted: "Accepted",
  closed: "Closed",
  link_unavailable: "Link Unavailable",
};
export const ME_STATUS_BADGE: Record<string, string> = {
  not_yet_linked: "badge-muted",
  linked_record_archived: "badge-muted",
  report_pending: "badge-warning",
  report_submitted: "badge-primary",
  returned_for_correction: "badge-danger",
  me_reviewed: "badge-primary",
  accepted: "badge-success",
  closed: "badge-success",
  link_unavailable: "badge-muted",
};
export const ACT_BADGE: Record<string, string> = {
  draft: "badge-muted", approved: "badge-success", in_progress: "badge-primary",
  completed: "badge-success", postponed: "badge-warning", cancelled: "badge-danger",
};
export const MS_BADGE: Record<string, string> = {
  pending: "badge-warning", achieved: "badge-success", missed: "badge-danger",
};
export const DEL_BADGE: Record<string, string> = {
  pending: "badge-warning", submitted: "badge-primary", accepted: "badge-success",
};
// Hardcoded to match config('pif.declaration_versions.v1') — the server is the
// source of truth for what was actually agreed (via the stored declaration_version),
// this is only client-side copy shown before submission.
export const DECLARATION_TEXT =
  "I confirm that this PIF relates to one activity, the information provided is accurate to the best of my knowledge, required supporting documents have been included, and any known conflict of interest has been disclosed.";

export const PROC_BADGE: Record<string, string> = {
  pending: "badge-warning", ordered: "badge-primary", delivered: "badge-success", cancelled: "badge-danger",
};
export const METHOD_LABEL: Record<string, string> = {
  direct_purchase: "Direct Purchase", three_quotations: "3 Quotations", tender: "Tender",
};
export const ATTACHMENT_TYPE_LABEL: Record<ProgrammeAttachmentType, string> = {
  concept_note: "Concept Note",
  memo: "Memo",
  hotel_quote: "Hotel Quote",
  transport_quote: "Transport Quote",
  other: "Other",
};

export type DetailTab = "overview" | "logistics" | "activities" | "milestones" | "budget" | "procurement" | "attachments" | "timeline" | "approval";

// ─── Modal wrapper ────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
