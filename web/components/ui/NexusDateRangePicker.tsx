"use client";

import { useEffect, useState } from "react";
import { workingDaysApi, type WorkingDaysResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/**
 * Two linked date inputs + a live working-day summary, calling the shared
 * /calendar/working-days endpoint (instruction §8/§18: never ask the user to
 * count calendar/working days by hand). Reusable outside Leave, which pioneered
 * this exact UX via its own debounced /leave/preview call.
 */
export function NexusDateRangePicker({
  idPrefix,
  startLabel,
  endLabel,
  startDate,
  endDate,
  onChange,
  dayPart = "full",
  countryCode,
  required,
  disabled,
  minDate,
}: {
  idPrefix: string;
  startLabel?: string;
  endLabel?: string;
  startDate: string;
  endDate: string;
  onChange: (next: { startDate: string; endDate: string }) => void;
  dayPart?: "full" | "morning" | "afternoon";
  countryCode?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
}) {
  const { t } = useI18n();
  const [result, setResult] = useState<WorkingDaysResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate || endDate < startDate) {
      setResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await workingDaysApi.calculate({
          start_date: startDate,
          end_date: endDate,
          day_part: dayPart,
          country_code: countryCode,
        });
        setResult(res.data.data);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [startDate, endDate, dayPart, countryCode]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${idPrefix}-start`} className="block text-xs font-medium text-neutral-700">
          {startLabel ?? t("common.startDate")}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
          <input
            id={`${idPrefix}-start`}
            type="date"
            className="form-input mt-1"
            value={startDate}
            min={minDate}
            disabled={disabled}
            required={required}
            onChange={(e) => onChange({ startDate: e.target.value, endDate: endDate < e.target.value ? e.target.value : endDate })}
          />
        </label>
        <label htmlFor={`${idPrefix}-end`} className="block text-xs font-medium text-neutral-700">
          {endLabel ?? t("common.endDate")}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
          <input
            id={`${idPrefix}-end`}
            type="date"
            className="form-input mt-1"
            value={endDate}
            min={startDate || minDate}
            disabled={disabled}
            required={required}
            onChange={(e) => onChange({ startDate, endDate: e.target.value })}
          />
        </label>
      </div>
      {loading ? (
        <p className="text-xs text-neutral-400">{t("common.loading")}</p>
      ) : result ? (
        <p className="text-xs text-neutral-600">
          {result.calendar_days} calendar day{result.calendar_days === 1 ? "" : "s"} · {result.working_days} working day{result.working_days === 1 ? "" : "s"}
          {result.public_holidays_excluded > 0 ? ` · ${result.public_holidays_excluded} public holiday${result.public_holidays_excluded === 1 ? "" : "s"} excluded` : ""}
        </p>
      ) : null}
    </div>
  );
}
