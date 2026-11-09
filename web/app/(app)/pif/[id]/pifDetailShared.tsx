// Presentation constants and dialog chrome for the PIF detail page.
import type { ReactNode } from "react";
import type { ProgrammeAttachmentType } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
/** Catalog keys; render with t(). */
export const STATUS_LABEL: Record<string, string> = {
  draft: "pif.status.draft", submitted: "pif.status.submitted", approved: "pif.status.approved", rejected: "pif.status.rejected", active: "pif.status.active",
  on_hold: "pif.status.on_hold", completed: "pif.status.completed", financially_closed: "pif.status.financially_closed", archived: "pif.status.archived",
  amended: "pif.status.amended", amendment_draft: "pif.status.amendment_draft",
  amendment_pending_approval: "pif.status.amendment_pending_approval", superseded: "pif.status.superseded",
};
/** Catalog keys; render with t(). */
export const ME_STATUS_LABEL: Record<string, string> = {
  not_yet_linked: "pif.meStatus.not_yet_linked",
  linked_record_archived: "pif.meStatus.linked_record_archived",
  report_pending: "pif.meStatus.report_pending",
  report_submitted: "pif.meStatus.report_submitted",
  returned_for_correction: "pif.meStatus.returned_for_correction",
  me_reviewed: "pif.meStatus.me_reviewed",
  accepted: "pif.meStatus.accepted",
  closed: "pif.meStatus.closed",
  link_unavailable: "pif.meStatus.link_unavailable",
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
// Catalog key for copy matching config('pif.declaration_versions.v1') — the server is the
// source of truth for what was actually agreed (via the stored declaration_version),
// this is only client-side copy shown before submission. Render with t().
export const DECLARATION_TEXT = "pif.detail.declaration";

export const PROC_BADGE: Record<string, string> = {
  pending: "badge-warning", ordered: "badge-primary", delivered: "badge-success", cancelled: "badge-danger",
};
/** Catalog keys; render with t(). */
export const METHOD_LABEL: Record<string, string> = {
  direct_purchase: "pif.method.direct_purchase", three_quotations: "pif.method.three_quotations", tender: "pif.method.tender",
};
/** Catalog keys; render with t(). */
export const ATTACHMENT_TYPE_LABEL: Record<ProgrammeAttachmentType, string> = {
  concept_note: "pif.attachmentType.concept_note",
  memo: "pif.attachmentType.memo",
  hotel_quote: "pif.attachmentType.hotel_quote",
  transport_quote: "pif.attachmentType.transport_quote",
  other: "pif.attachmentType.other",
};

export type DetailTab = "overview" | "logistics" | "activities" | "milestones" | "budget" | "procurement" | "attachments" | "timeline" | "approval";

// ─── Modal wrapper ────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">{t(title)}</h2>
          <button type="button" onClick={onClose} aria-label={t("pif.detail.closeDialog", { title: t(title) })} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
