import { Badge } from "@/components/ui/Badge";

/**
 * Canonical status vocabulary (instruction §25/§26): one consistent set of
 * labels/colors across Nexus instead of each module choosing its own
 * Pending/Waiting/In Progress/Awaiting synonyms for the same concept.
 * Keys are the raw backend status strings already in use (draft, submitted,
 * approved, rejected, returned, cancelled, withdrawn, completed, archived,
 * plus a few common "awaiting_x"/"under_review" variants) — unrecognized
 * statuses fall back to a muted badge showing the raw value rather than
 * hiding it.
 */
export const STATUS_BADGE_MAP: Record<string, { label: string; variant: "primary" | "success" | "warning" | "danger" | "muted" | "info" }> = {
  draft: { label: "Draft", variant: "muted" },
  submitted: { label: "Submitted", variant: "info" },
  under_review: { label: "Under Review", variant: "info" },
  pending: { label: "Awaiting Approval", variant: "warning" },
  awaiting_approval: { label: "Awaiting Approval", variant: "warning" },
  recommended: { label: "Awaiting Approval", variant: "warning" },
  certified: { label: "Awaiting Approval", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  returned: { label: "Returned for Changes", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "muted" },
  withdrawn: { label: "Cancelled", variant: "muted" },
  completed: { label: "Completed", variant: "success" },
  archived: { label: "Archived", variant: "muted" },
};

export function NexusStatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS_BADGE_MAP[status?.toLowerCase()] ?? { label: status, variant: "muted" as const };
  return (
    <Badge variant={entry.variant} className={className}>
      {entry.label}
    </Badge>
  );
}
