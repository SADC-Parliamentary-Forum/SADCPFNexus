"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface ModulePageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  /** Constrain to the same width as register pages */
  maxWidth?: "3xl" | "4xl" | "6xl" | "none";
}

const MAX_WIDTH: Record<NonNullable<ModulePageHeaderProps["maxWidth"]>, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  none: "",
};

/**
 * Canonical page chrome for module detail / form / utility pages.
 * Matches RegisterShell header density without inventing a new aesthetic.
 */
export function ModulePageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  meta,
  className,
  maxWidth = "none",
}: ModulePageHeaderProps) {
  const { t } = useI18n();
  return (
    <div className={cn(MAX_WIDTH[maxWidth], maxWidth !== "none" && "mx-auto", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {breadcrumbs}
          <h1 className="page-title">{t(title)}</h1>
          {subtitle ? (
            typeof subtitle === "string" ? (
              <p className="page-subtitle">{t(subtitle)}</p>
            ) : (
              <div className="page-subtitle">{subtitle}</div>
            )
          ) : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Compact breadcrumb row used under ModulePageHeader / RegisterShell. */
export function PageBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useI18n();
  return (
    <nav className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-neutral-700" aria-label={t("common.breadcrumb")}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const label = t(item.label);
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span className="material-symbols-outlined text-[14px] text-neutral-300">chevron_right</span>
            ) : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-primary">
                {label}
              </Link>
            ) : (
              <span className={isLast ? "text-neutral-700" : undefined}>{label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
