export type SupplierTone = "success" | "warning" | "danger" | "info" | "neutral";

export type SupplierStatusPresentation = {
  code: string;
  icon: string;
  tone: SupplierTone;
  labelKey: string;
  fallback: string;
};

export const SUPPLIER_TONE_STYLES: Record<
  SupplierTone,
  { iconBg: string; iconColor: string; badge: string; bar: string }
> = {
  success: {
    iconBg: "bg-green-50 dark:bg-green-900/20",
    iconColor: "text-green-600",
    badge: "badge-success",
    bar: "bg-green-500",
  },
  warning: {
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
    iconColor: "text-amber-600",
    badge: "badge-warning",
    bar: "bg-amber-500",
  },
  danger: {
    iconBg: "bg-red-50 dark:bg-red-900/20",
    iconColor: "text-red-600",
    badge: "badge-danger",
    bar: "bg-red-500",
  },
  info: {
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    iconColor: "text-blue-600",
    badge: "badge-primary",
    bar: "bg-blue-500",
  },
  neutral: {
    iconBg: "bg-neutral-100 dark:bg-neutral-800",
    iconColor: "text-neutral-600",
    badge: "badge-muted",
    bar: "bg-neutral-400",
  },
};

const REGISTRATION: Record<string, { icon: string; tone: SupplierTone; labelKey: string }> = {
  draft: { icon: "edit_note", tone: "neutral", labelKey: "supplier.status.draft" },
  submitted: { icon: "send", tone: "info", labelKey: "supplier.status.submitted" },
  under_review: { icon: "hourglass_top", tone: "info", labelKey: "supplier.status.under_review" },
  correction_required: { icon: "edit_document", tone: "warning", labelKey: "supplier.status.correction_required" },
  conditionally_approved: { icon: "verified_user", tone: "success", labelKey: "supplier.status.conditionally_approved" },
  approved: { icon: "verified_user", tone: "success", labelKey: "supplier.status.approved" },
  compliance_warning: { icon: "warning", tone: "warning", labelKey: "supplier.status.compliance_warning" },
  expired: { icon: "event_busy", tone: "danger", labelKey: "supplier.status.expired" },
  suspended: { icon: "pause_circle", tone: "danger", labelKey: "supplier.status.suspended" },
  debarred: { icon: "gavel", tone: "danger", labelKey: "supplier.status.debarred" },
  rejected: { icon: "cancel", tone: "danger", labelKey: "supplier.status.rejected" },
  archived: { icon: "inventory_2", tone: "neutral", labelKey: "supplier.status.archived" },
};

const COMPLIANCE: Record<string, { icon: string; tone: SupplierTone; labelKey: string }> = {
  valid: { icon: "verified", tone: "success", labelKey: "supplier.compliance.valid" },
  expiring: { icon: "event_upcoming", tone: "warning", labelKey: "supplier.compliance.expiring" },
  non_compliant: { icon: "gpp_bad", tone: "danger", labelKey: "supplier.compliance.non_compliant" },
  unknown: { icon: "help", tone: "neutral", labelKey: "supplier.compliance.unknown" },
};

const ACTION_ICONS: Record<string, string> = {
  submit_application: "send",
  expiring_document: "event_busy",
  mandatory_documents: "folder_open",
  open_rfqs: "request_quote",
  po_ack: "receipt_long",
};

export function humanizeSnake(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function registrationPresentation(status?: string | null): SupplierStatusPresentation {
  const code = (status ?? "draft").trim() || "draft";
  const mapped = REGISTRATION[code];
  return {
    code,
    icon: mapped?.icon ?? "badge",
    tone: mapped?.tone ?? "neutral",
    labelKey: mapped?.labelKey ?? "",
    fallback: humanizeSnake(code) || "Unknown",
  };
}

export function compliancePresentation(status?: string | null): SupplierStatusPresentation {
  const code = (status ?? "unknown").trim() || "unknown";
  const mapped = COMPLIANCE[code];
  return {
    code,
    icon: mapped?.icon ?? "policy",
    tone: mapped?.tone ?? "neutral",
    labelKey: mapped?.labelKey ?? "",
    fallback: code === "non_compliant" ? "Non-compliant" : humanizeSnake(code) || "Unknown",
  };
}

export function completenessTone(percent: number): SupplierTone {
  if (percent >= 90) return "success";
  if (percent >= 50) return "warning";
  return "danger";
}

export function actionIcon(code?: string | null): string {
  return ACTION_ICONS[code ?? ""] ?? "task_alt";
}
