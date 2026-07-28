"use client";

import type { ReactNode } from "react";

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
      className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="text-xs font-semibold text-primary">
        {count} selected
      </span>
      {children}
      <button
        type="button"
        disabled={disabled}
        onClick={onClear}
        className="text-xs text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
      >
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
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/30 disabled:opacity-40"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !checked && indeterminate;
      }}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
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
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      title={title}
      aria-label={label}
    />
  );
}
