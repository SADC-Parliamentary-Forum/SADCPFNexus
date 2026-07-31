"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type RegisterMobileField = {
  label: string;
  value: ReactNode;
};

interface RegisterMobileCardsProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  title: (item: T) => ReactNode;
  subtitle?: (item: T) => ReactNode;
  badge?: (item: T) => ReactNode;
  fields?: (item: T) => RegisterMobileField[];
  actions?: (item: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
  /** Shown on desktop; cards are md:hidden by default when used with a table. */
  alwaysShow?: boolean;
}

/**
 * Mobile card fallback for wide register tables.
 * Pair with a `hidden md:block` table wrapper for desktop.
 */
export function RegisterMobileCards<T>({
  items,
  getKey,
  title,
  subtitle,
  badge,
  fields,
  actions,
  empty,
  className,
  alwaysShow = false,
}: RegisterMobileCardsProps<T>) {
  if (items.length === 0) {
    return empty ? <div className={cn(alwaysShow ? "" : "md:hidden", className)}>{empty}</div> : null;
  }

  return (
    <ul className={cn("space-y-3", alwaysShow ? "" : "md:hidden", className)}>
      {items.map((item) => {
        const fieldList = fields?.(item) ?? [];
        return (
          <li key={getKey(item)} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {title(item)}
                </div>
                {subtitle && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {subtitle(item)}
                  </div>
                )}
              </div>
              {badge && <div className="flex-shrink-0">{badge(item)}</div>}
            </div>
            {fieldList.length > 0 && (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {fieldList.map((f) => (
                  <div key={f.label}>
                    <dt className="text-[10px] uppercase tracking-wide text-neutral-400">{f.label}</dt>
                    <dd className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">{actions(item)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
