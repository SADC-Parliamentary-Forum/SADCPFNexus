"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Currency-formatted numeric input (instruction §19: thousands separators,
 * consistent currency prefix, decimal handling, reject invalid characters).
 * Reports the parsed numeric value via onValueChange; the visible text is
 * formatted independently so the user never has to type separators.
 */
export function NexusMoneyInput({
  id,
  label,
  value,
  onValueChange,
  currency = "N$",
  required,
  disabled,
  error,
  className,
  placeholder,
}: {
  id: string;
  label?: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
  currency?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => formatDisplay(value));

  // Keep the displayed text in sync when the value changes externally
  // (e.g. a calculated total), but not while the user is actively typing.
  useEffect(() => {
    setText(formatDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          {label}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">{currency}</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          required={required}
          placeholder={placeholder ?? "0.00"}
          value={text}
          className={cn(
            "w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-10 pr-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400",
            "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-50",
            error && "border-red-400 focus:border-red-400 focus:ring-red-400",
            className,
          )}
          onChange={(e) => {
            // Allow only digits, one decimal point, while typing.
            const raw = e.target.value.replace(/[^\d.]/g, "");
            const parts = raw.split(".");
            const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;
            setText(cleaned);
            onValueChange(cleaned === "" ? null : Number(cleaned));
          }}
          onBlur={() => setText(formatDisplay(value))}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function formatDisplay(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
