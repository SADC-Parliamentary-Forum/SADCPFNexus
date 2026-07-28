"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

interface BulkSelectionBarProps {
  count: number;
  onClear: () => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Selection action strip shown above register tables when rows are checked.
 */
export function BulkSelectionBar({
  count,
  onClear,
  disabled = false,
  children,
  className = "",
}: BulkSelectionBarProps) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 sm:gap-3 sm:px-4",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
        <span
          className="material-symbols-outlined text-[14px] leading-none"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 500" }}
          aria-hidden
        >
          check_box
        </span>
        {count} selected
      </span>

      {children ? (
        <>
          <span className="hidden h-4 w-px bg-primary/15 sm:block" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-white/80 hover:text-neutral-800 disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden>
          close
        </span>
        Clear
      </button>
    </div>
  );
}

interface SelectAllCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

/** Header checkbox for select-all over selectable rows. */
export function SelectAllCheckbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  label = "Select all",
}: SelectAllCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      indeterminate={indeterminate}
      onChange={() => onChange()}
      disabled={disabled}
      aria-label={label}
      className="-m-2"
    />
  );
}

interface RowCheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
  label: string;
}

export function RowCheckbox({
  checked,
  onChange,
  disabled = false,
  title,
  label,
}: RowCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      onChange={() => onChange()}
      disabled={disabled}
      title={title}
      aria-label={label}
      className="-m-2"
    />
  );
}

/** Shared narrow column classes for selection checkboxes in data tables. */
export const selectionColumnClass = {
  th: "w-12 !px-2 text-center align-middle",
  td: "!px-2 text-center align-middle",
} as const;
