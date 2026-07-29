"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RegisterDensity = "comfortable" | "compact";

interface RegisterShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  bulkBar?: ReactNode;
  stats?: ReactNode;
  density?: RegisterDensity;
  onDensityChange?: (density: RegisterDensity) => void;
  page?: number;
  pageCount?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  empty?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Shared register chrome: header, filters, density, pagination.
 * Prefer adapting existing list pages onto this shell rather than inventing a new design system.
 */
export function RegisterShell({
  title,
  subtitle,
  breadcrumbs,
  actions,
  filters,
  bulkBar,
  stats,
  density = "comfortable",
  onDensityChange,
  page = 1,
  pageCount = 1,
  total,
  onPageChange,
  loading = false,
  empty,
  children,
  className,
}: RegisterShellProps) {
  const showPagination = typeof onPageChange === "function" && pageCount > 1;

  return (
    <div className={cn("mx-auto max-w-6xl space-y-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {breadcrumbs}
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {stats}

      {(filters || bulkBar || onDensityChange) && (
        <div className="card flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-end gap-3">
            {filters ? <div className="min-w-0 flex-1">{filters}</div> : null}
            {onDensityChange ? (
              <div className="flex items-center gap-1 rounded-lg border border-neutral-200 p-0.5">
                {(["comfortable", "compact"] as RegisterDensity[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDensityChange(d)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                      density === d
                        ? "bg-primary/10 text-primary"
                        : "text-neutral-500 hover:text-neutral-800",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {bulkBar}
        </div>
      )}

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : empty ? (
        empty
      ) : (
        <div className={cn(density === "compact" && "text-sm [&_td]:py-2 [&_th]:py-2")}>{children}</div>
      )}

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
          <span>
            Page {page} of {pageCount}
            {typeof total === "number" ? ` · ${total} rows` : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={page <= 1}
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={page >= pageCount}
              onClick={() => onPageChange?.(Math.min(pageCount, page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
