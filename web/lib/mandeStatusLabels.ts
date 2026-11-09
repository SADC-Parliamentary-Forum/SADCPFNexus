type Translate = (key: string, vars?: Record<string, string | number>) => string;

const REVIEW_STATUSES = new Set(["not_submitted", "submitted", "returned", "reviewed", "accepted", "closed", "not_reportable", "cancelled"]);

/** Translated label for an M&E activity report review status; unknown values fall back to the raw status. */
export function reviewStatusLabel(t: Translate, status: string): string {
  return REVIEW_STATUSES.has(status) ? t(`mande.reviewStatus.${status}`) : status.replace(/_/g, " ");
}
