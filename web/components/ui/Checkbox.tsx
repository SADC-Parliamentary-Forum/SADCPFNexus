"use client";

import { useEffect, useId, useRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "onChange"> {
  /** Controlled checked state. */
  checked: boolean;
  /** Partial selection (select-all header). Overrides the check glyph when true and not fully checked. */
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  /** Visible label text (optional when aria-label is provided). */
  label?: string;
  /** Tooltip — important for disabled/protected rows. */
  title?: string;
  size?: "sm" | "md";
  className?: string;
}

const sizeMap = {
  sm: {
    box: "h-4 w-4",
    icon: "text-[12px]",
    hit: "h-8 w-8",
  },
  md: {
    box: "h-[1.125rem] w-[1.125rem]",
    icon: "text-[14px]",
    hit: "h-9 w-9",
  },
} as const;

/**
 * Nexus-styled checkbox. Visually-hidden native input + custom box so
 * appearance stays consistent without @tailwindcss/forms.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  label,
  title,
  size = "sm",
  className,
  id: idProp,
  "aria-label": ariaLabel,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const dims = sizeMap[size];
  const showIndeterminate = Boolean(indeterminate) && !checked;
  const filled = checked || showIndeterminate;
  const tip = title?.trim() || undefined;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = showIndeterminate;
    }
  }, [showIndeterminate]);

  return (
    <span
      className={cn("group/cb relative inline-flex items-center justify-center", className)}
      title={tip}
    >
      <label
        className={cn(
          "relative inline-flex items-center justify-center rounded-md",
          dims.hit,
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <input
          {...rest}
          ref={inputRef}
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          aria-checked={showIndeterminate ? "mixed" : checked}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none flex shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color,box-shadow,opacity] duration-150",
            dims.box,
            filled
              ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
              : "border-neutral-300 bg-white text-transparent dark:border-neutral-600 dark:bg-neutral-900",
            !disabled &&
              !filled &&
              "peer-hover:border-primary/55 peer-hover:bg-primary/[0.04]",
            !disabled &&
              filled &&
              "peer-hover:border-primary-600 peer-hover:bg-primary-600",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/35 peer-focus-visible:ring-offset-2",
            disabled &&
              (filled
                ? "opacity-45"
                : "border-dashed border-neutral-300 bg-neutral-50 opacity-60 dark:border-neutral-600 dark:bg-neutral-800/60"),
          )}
        >
          {showIndeterminate ? (
            <span
              className={cn("material-symbols-outlined leading-none", dims.icon)}
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
            >
              remove
            </span>
          ) : (
            <span
              className={cn(
                "material-symbols-outlined leading-none transition-opacity",
                dims.icon,
                checked ? "opacity-100" : "opacity-0",
              )}
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
            >
              check
            </span>
          )}
        </span>
        {label ? (
          <span className="ml-2 text-sm text-neutral-700 peer-disabled:text-neutral-400">
            {label}
          </span>
        ) : null}
      </label>

      {tip && disabled ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2",
            "max-w-[14rem] whitespace-normal rounded-md bg-neutral-900 px-2 py-1 text-center text-[10px] font-medium leading-snug text-white shadow-lg",
            "opacity-0 transition-opacity delay-200 group-hover/cb:opacity-100",
          )}
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}
