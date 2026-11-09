"use client";

import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/**
 * Canonical status vocabulary (instruction §25/§26): one consistent set of
 * labels/colors across Nexus instead of each module choosing its own
 * Pending/Waiting/In Progress/Awaiting synonyms for the same concept.
 * Keys are the raw backend status strings already in use (draft, submitted,
 * approved, rejected, returned, cancelled, withdrawn, completed, archived,
 * plus a few common "awaiting_x"/"under_review" variants) — unrecognized
 * statuses fall back to a muted badge showing the raw value rather than
 * hiding it. `label` holds an i18n key.
 */
export const STATUS_BADGE_MAP: Record<string, { label: string; variant: "primary" | "success" | "warning" | "danger" | "muted" | "info" }> = {
  draft: { label: "status.draft", variant: "muted" },
  submitted: { label: "status.submitted", variant: "info" },
  under_review: { label: "ui.statusBadge.underReview", variant: "info" },
  pending: { label: "ui.statusBadge.awaitingApproval", variant: "warning" },
  awaiting_approval: { label: "ui.statusBadge.awaitingApproval", variant: "warning" },
  recommended: { label: "ui.statusBadge.awaitingApproval", variant: "warning" },
  certified: { label: "ui.statusBadge.awaitingApproval", variant: "warning" },
  approved: { label: "status.approved", variant: "success" },
  rejected: { label: "status.rejected", variant: "danger" },
  returned: { label: "ui.statusBadge.returned", variant: "warning" },
  cancelled: { label: "status.cancelled", variant: "muted" },
  withdrawn: { label: "status.cancelled", variant: "muted" },
  completed: { label: "ui.statusBadge.completed", variant: "success" },
  archived: { label: "ui.statusBadge.archived", variant: "muted" },
};

export function NexusStatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const known = STATUS_BADGE_MAP[status?.toLowerCase()];
  return (
    <Badge variant={known?.variant ?? "muted"} className={className}>
      {known ? t(known.label) : status}
    </Badge>
  );
}
