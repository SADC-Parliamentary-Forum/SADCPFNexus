"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NeedToggle({
  label,
  checked,
  onChange,
  hint,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div
      data-testid="pif-need-toggle"
      className={cn(
        "rounded-xl border p-3 transition-colors",
        checked ? "border-primary/30 bg-primary/5" : "border-neutral-200 bg-white",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 rounded border-neutral-300"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-neutral-800">{label}</span>
          {hint ? <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">{hint}</span> : null}
        </span>
      </label>
      {checked && children ? <div className="mt-3 space-y-3 pl-7">{children}</div> : null}
    </div>
  );
}
