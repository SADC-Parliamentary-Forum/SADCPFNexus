"use client";

import type { ReactNode } from "react";

function labelFor(key: string): string {
  return key.replace(/_/g, " ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function primitive(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function LabelledRecord({ value, nested = false }: { value: unknown; nested?: boolean }) {
  if (value == null || value === "") {
    return <span className="text-neutral-400">—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-neutral-400">—</span>;
    return (
      <ul className="space-y-1 text-left">
        {value.map((item, idx) => (
          <li key={idx}>
            <LabelledRecord value={item} nested />
          </li>
        ))}
      </ul>
    );
  }
  const rec = asRecord(value);
  if (!rec) {
    return <span>{primitive(value)}</span>;
  }
  const entries = Object.entries(rec);
  if (entries.length === 0) return <span className="text-neutral-400">—</span>;
  return (
    <dl className={nested ? "grid gap-1 text-xs" : "grid gap-2 text-sm"}>
      {entries.map(([key, child]) => (
        <div key={key} className="flex justify-between gap-4 border-b border-neutral-100 py-2 last:border-0">
          <dt className="capitalize text-neutral-500">{labelFor(key)}</dt>
          <dd className="max-w-[70%] text-right font-medium text-neutral-800 break-words">
            <LabelledRecord value={child} nested />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function LabelledChangeRows({
  oldValues,
  newValues,
}: {
  oldValues: unknown;
  newValues: unknown;
}): ReactNode {
  const oldRec = asRecord(oldValues) ?? {};
  const newRec = asRecord(newValues) ?? {};
  const keys = Array.from(new Set([...Object.keys(oldRec), ...Object.keys(newRec)]));

  if (keys.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs text-neutral-500 mb-1">Previous</p>
          <LabelledRecord value={oldValues} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1">Updated</p>
          <LabelledRecord value={newValues} />
        </div>
      </div>
    );
  }

  return (
    <dl className="space-y-2 text-sm">
      {keys.map((key) => (
        <div
          key={key}
          className="labelled-change-row rounded-lg border border-neutral-200 bg-neutral-50 p-3"
        >
          <dt className="capitalize text-xs font-semibold text-neutral-600">{labelFor(key)}</dt>
          <dd className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Previous</p>
              <LabelledRecord value={oldRec[key]} nested />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Updated</p>
              <LabelledRecord value={newRec[key]} nested />
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}
