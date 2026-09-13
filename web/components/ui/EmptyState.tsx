"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Shared empty / no-results panel for registers and utility pages. */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const { t } = useI18n();
  return (
    <div className={cn("flex min-h-[200px] flex-col items-center justify-center gap-2 px-5 py-12 text-center", className)}>
      <span className="material-symbols-outlined mb-1 text-5xl text-neutral-200">{icon}</span>
      <p className="text-sm font-semibold text-neutral-600">{t(title)}</p>
      {description ? <p className="max-w-sm text-xs text-neutral-400">{t(description)}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Inline error strip for registers — Retry/Dismiss use gold buttons, never text-link actions. */
export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="material-symbols-outlined text-[16px]">error_outline</span>
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button type="button" className="btn-secondary text-xs" onClick={onRetry}>
          Retry
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" className="btn-secondary text-xs" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

/** Empty row for data tables — keeps table structure while using shared EmptyState chrome. */
export function TableEmpty({
  colSpan,
  icon = "inbox",
  title,
  description,
  action,
}: {
  colSpan: number;
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <EmptyState icon={icon} title={title} description={description} action={action} className="min-h-[160px] py-8" />
      </td>
    </tr>
  );
}
