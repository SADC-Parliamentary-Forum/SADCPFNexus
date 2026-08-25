"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/ui/FormSection";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const WRITABLE = ["pending", "cleared", "not_cleared"] as const;

export function ClearanceEditor({
  taskId,
  current,
  disabled,
  testId,
  onSave,
}: {
  taskId: number;
  current: string;
  disabled?: boolean;
  testId: string;
  onSave: (status: "pending" | "cleared" | "not_cleared") => void;
}) {
  const { confirm } = useConfirm();
  const writable = WRITABLE.includes(current as (typeof WRITABLE)[number]) ? current : current;
  const [value, setValue] = useState(writable);

  useEffect(() => {
    setValue(writable);
  }, [writable]);

  const locked = disabled || current === "exception_pending" || current === "exception_approved";
  const displayValue = WRITABLE.includes(value as (typeof WRITABLE)[number]) ? value : current;

  return (
    <FormField label="Clearance" htmlFor={`${testId}-${taskId}`}>
      <div className="flex flex-wrap gap-2">
        <select
          id={`${testId}-${taskId}`}
          data-testid={testId}
          className="input flex-1 min-w-[10rem]"
          value={displayValue}
          disabled={locked}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="cleared">Cleared</option>
          <option value="not_cleared">Not cleared</option>
          {current === "exception_pending" ? <option value="exception_pending">Exception pending</option> : null}
          {current === "exception_approved" ? <option value="exception_approved">Exception approved</option> : null}
        </select>
        <button
          type="button"
          className="btn-secondary text-xs whitespace-nowrap"
          disabled={locked || value === current || !WRITABLE.includes(value as (typeof WRITABLE)[number])}
          onClick={async () => {
            if (!WRITABLE.includes(value as (typeof WRITABLE)[number])) return;
            if (value === "not_cleared") {
              const ok = await confirm({
                title: "Mark this clearance as not cleared?",
                message: "Not cleared blocks terminal payment. Clearing later requires an authorised exception.",
                confirmText: "Mark not cleared",
                variant: "danger",
              });
              if (!ok) return;
            }
            onSave(value as "pending" | "cleared" | "not_cleared");
          }}
        >
          Save clearance
        </button>
      </div>
    </FormField>
  );
}
