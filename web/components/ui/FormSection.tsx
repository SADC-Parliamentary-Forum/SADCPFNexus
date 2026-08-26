"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Compact padding for dense admin forms */
  dense?: boolean;
}

/**
 * Card section with title + optional icon — shared create/edit form rhythm
 * (Travel create wizard, Leave create, PIF edit).
 */
export function FormSection({
  title,
  description,
  icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  actions,
  children,
  className,
  dense = false,
}: FormSectionProps) {
  return (
    <section className={cn("card", dense ? "p-4" : "p-5 sm:p-6", className)}>
      <div className={cn("flex items-start justify-between gap-3", description || children ? "mb-4" : "")}>
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", iconBg)}>
              <span className={cn("material-symbols-outlined text-[18px]", iconColor)}>{icon}</span>
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Label + control + optional hint/error — consistent form field chrome. */
export function FormField({ label, htmlFor, required, hint, error, children, className }: FormFieldProps) {
  return (
    <label className={cn("block space-y-1.5", className)} htmlFor={htmlFor}>
      <span className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs text-red-600">{error}</span> : null}
      {!error && hint ? <span className="block text-[11px] text-neutral-400">{hint}</span> : null}
    </label>
  );
}
