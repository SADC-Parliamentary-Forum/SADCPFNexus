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
