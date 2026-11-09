"use client";

import { cn, formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const ISO_DATE_VALUE =
  /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatPrimitive(value: unknown, t: Translate): string {
  if (value === null || value === undefined || value === "") return t("ui.objectSummary.none");
  if (typeof value === "boolean") return value ? t("ui.labelledRecord.yes") : t("ui.labelledRecord.no");
  if (typeof value === "number") return value.toLocaleString();
  const text = String(value);
  if (ISO_DATE_VALUE.test(text)) return formatDateShort(text);
  return text;
}

function getColumns(rows: Record<string, unknown>[]) {
  const keys = new Set<string>();
  rows.slice(0, 8).forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key));
  });
  return Array.from(keys).slice(0, 6);
}

function ValueCell({ value }: { value: unknown }) {
  const { t } = useI18n();
  if (Array.isArray(value)) {
    return <span>{t(value.length === 1 ? "ui.objectSummary.item" : "ui.objectSummary.items", { count: value.length.toLocaleString() })}</span>;
  }
  if (isRecord(value)) {
    return <span>{t(Object.keys(value).length === 1 ? "ui.objectSummary.field" : "ui.objectSummary.fields", { count: Object.keys(value).length.toLocaleString() })}</span>;
  }
  return <span>{formatPrimitive(value, t)}</span>;
}

export function ObjectSummary({
  value,
  emptyLabel: emptyLabelProp,
  className,
}: {
  value: unknown;
  emptyLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const emptyLabel = emptyLabelProp ?? t("ui.objectSummary.empty");
  if (value === null || value === undefined) {
    return (
      <div className={cn("rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500", className)}>
        {emptyLabel}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className={cn("rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500", className)}>
          {emptyLabel}
        </div>
      );
    }

    const records = value.filter(isRecord);
    if (records.length === value.length) {
      const columns = getColumns(records);
      return (
        <div className={cn("overflow-x-auto rounded-lg border border-neutral-200", className)}>
          <table className="data-table">
            <caption className="sr-only">{t("ui.objectSummary.caption")}</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">{formatKey(column)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 10).map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column}>
                      <ValueCell value={row[column]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {records.length > 10 ? (
            <div className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500">
              {t("ui.objectSummary.showing", { total: records.length.toLocaleString() })}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
        {value.slice(0, 12).map((item, index) => (
          <li key={index} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
            <ValueCell value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return (
        <div className={cn("rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500", className)}>
          {emptyLabel}
        </div>
      );
    }

    return (
      <dl className={cn("grid gap-3 sm:grid-cols-2", className)}>
        {entries.map(([key, item]) => (
          <div key={key} className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{formatKey(key)}</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-900">
              <ValueCell value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-900", className)}>
      {formatPrimitive(value, t)}
    </div>
  );
}
