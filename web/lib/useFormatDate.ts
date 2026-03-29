"use client";

import { usePrefs } from "@/components/providers/PrefsProvider";
import { formatDateByFormat, formatDateRelative } from "@/lib/utils";

/**
 * Returns date formatters bound to the user's chosen date format preference.
 *
 * Usage:
 *   const { fmt, fmtRelative } = useFormatDate();
 *   fmt(someDate)           // e.g. "22/03/2026"
 *   fmtRelative(someDate)   // e.g. "Today" / "Yesterday" / "22/03/2026"
 */
export function useFormatDate() {
  const { dateFormat } = usePrefs();
  return {
    fmt:         (date: string | Date | null | undefined) => formatDateByFormat(date, dateFormat),
    fmtRelative: (date: string | Date | null | undefined) => formatDateRelative(date, dateFormat),
  };
}
