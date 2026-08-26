"use client";

import { cn } from "@/lib/utils";

const SUCCESS = new Set([
  "accepted",
  "active",
  "allowed",
  "approved",
  "certified",
  "cleared",
  "closed",
  "completed",
  "issued",
  "ready",
  "recommended",
  "success",
  "verified_closed",
]);

const DANGER = new Set([
  "blocked",
  "cancelled",
  "critical",
  "denied",
  "failed",
  "ineligible",
  "not_cleared",
  "overdue",
  "rejected",
  "returned",
]);

const WARNING = new Set([
  "at_risk",
  "awaiting_acceptance",
  "draft",
  "due_for_verification",
  "exception_pending",
  "high",
  "in_progress",
  "medium",
  "pending",
  "submitted",
]);

const INFO = new Set(["info", "low", "open"]);

function badgeClass(value: string): string {
  if (SUCCESS.has(value)) return "badge-success";
  if (DANGER.has(value)) return "badge-danger";
  if (WARNING.has(value)) return "badge-warning";
  if (INFO.has(value)) return "badge-info";
  return "badge-muted";
}

function labelFor(value: string): string {
  return value.replaceAll("_", " ");
}

/** Status / rating chip using the shared badge tokens. */
export function StatusPill({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replaceAll(" ", "_");

  return (
    <span className={cn("badge capitalize", badgeClass(key), className)}>
      {labelFor(raw)}
    </span>
  );
}
