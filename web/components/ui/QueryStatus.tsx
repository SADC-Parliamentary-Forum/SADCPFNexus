"use client";

import { cn } from "@/lib/utils";

interface QueryStatusProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: string;
  loadingRows?: number;
  className?: string;
}

/** Shared loading skeleton and error alert for module pages. */
export function QueryStatus({
  isLoading = false,
  isError = false,
  error = "This information could not be loaded.",
  loadingRows = 4,
  className,
}: QueryStatusProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        {Array.from({ length: loadingRows }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("alert alert-error", className)} role="alert">
        {error}
      </div>
    );
  }

  return null;
}
