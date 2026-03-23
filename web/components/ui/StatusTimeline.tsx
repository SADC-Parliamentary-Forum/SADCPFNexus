"use client";

import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
  icon: string; // material symbol name
  completedAt?: string | null; // ISO date string
}

interface StatusTimelineProps {
  steps: Step[];
  currentStatus: string; // matches one of the step keys
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

export function StatusTimeline({
  steps,
  currentStatus,
  rejectedAt,
  rejectionReason,
}: StatusTimelineProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStatus);
  const isRejected = !!rejectedAt;

  function getStepState(index: number): "completed" | "current" | "rejected" | "future" {
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return isRejected ? "rejected" : "current";
    return "future";
  }

  return (
    <div className="w-full">
      {/* ── Desktop: horizontal ── */}
      <div className="hidden sm:flex items-start w-full">
        {steps.map((step, index) => {
          const state = getStepState(index);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.key} className="flex items-start flex-1 last:flex-none">
              {/* Step node + label */}
              <div className="flex flex-col items-center min-w-0">
                {/* Circle */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    state === "completed" &&
                      "border-primary bg-primary text-white shadow-sm",
                    state === "current" &&
                      "border-primary bg-white text-primary shadow-md ring-4 ring-primary/10",
                    state === "rejected" &&
                      "border-red-500 bg-red-500 text-white shadow-sm",
                    state === "future" &&
                      "border-neutral-200 bg-white text-neutral-400"
                  )}
                >
                  {state === "rejected" ? (
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  ) : state === "completed" ? (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                  )}
                </div>

                {/* Label */}
                <p
                  className={cn(
                    "mt-2 text-xs font-medium text-center whitespace-nowrap",
                    state === "completed" && "text-neutral-700",
                    state === "current" && "text-primary font-semibold",
                    state === "rejected" && "text-red-600 font-semibold",
                    state === "future" && "text-neutral-400"
                  )}
                >
                  {step.label}
                </p>

                {/* Completed date */}
                {state === "completed" && step.completedAt && (
                  <p className="mt-0.5 text-[10px] text-neutral-400 text-center whitespace-nowrap">
                    {formatDateShort(step.completedAt)}
                  </p>
                )}

                {/* Rejected date */}
                {state === "rejected" && rejectedAt && (
                  <p className="mt-0.5 text-[10px] text-red-400 text-center whitespace-nowrap">
                    {formatDateShort(rejectedAt)}
                  </p>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 mt-5 transition-colors",
                    state === "completed" ? "bg-primary" : "bg-neutral-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile: vertical ── */}
      <div className="flex sm:hidden flex-col gap-0">
        {steps.map((step, index) => {
          const state = getStepState(index);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.key} className="flex items-start gap-3">
              {/* Left: circle + vertical line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    state === "completed" &&
                      "border-primary bg-primary text-white",
                    state === "current" &&
                      "border-primary bg-white text-primary ring-4 ring-primary/10",
                    state === "rejected" &&
                      "border-red-500 bg-red-500 text-white",
                    state === "future" &&
                      "border-neutral-200 bg-white text-neutral-400"
                  )}
                >
                  {state === "rejected" ? (
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  ) : state === "completed" ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">{step.icon}</span>
                  )}
                </div>

                {/* Vertical connector */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 my-1 min-h-[24px] transition-colors",
                      state === "completed" ? "bg-primary" : "bg-neutral-200"
                    )}
                  />
                )}
              </div>

              {/* Right: label + date */}
              <div className="pb-5 pt-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium leading-tight",
                    state === "completed" && "text-neutral-700",
                    state === "current" && "text-primary font-semibold",
                    state === "rejected" && "text-red-600 font-semibold",
                    state === "future" && "text-neutral-400"
                  )}
                >
                  {step.label}
                </p>

                {state === "completed" && step.completedAt && (
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    {formatDateShort(step.completedAt)}
                  </p>
                )}

                {state === "rejected" && rejectedAt && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {formatDateShort(rejectedAt)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rejection reason banner */}
      {isRejected && rejectionReason && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0 mt-0.5">
            cancel
          </span>
          <div>
            <p className="text-xs font-semibold text-red-700">Rejection reason</p>
            <p className="text-sm text-red-600 mt-0.5">{rejectionReason}</p>
          </div>
        </div>
      )}
    </div>
  );
}
