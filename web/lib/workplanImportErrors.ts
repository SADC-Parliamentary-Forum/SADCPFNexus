/**
 * Pure helpers for workplan CSV import error toasts.
 * Side-effect free so unit tests can lock behaviour without React/DOM.
 */

const MISSING_MEETING_TYPE = /Meeting type "([^"]+)" not found/i;

export function uniqueMissingMeetingTypes(
  errors: Array<{ message: string }>,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const error of errors) {
    const match = error.message.match(MISSING_MEETING_TYPE);
    if (!match) continue;
    const name = match[1].trim();
    if (name === "") continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function formatWorkplanImportErrorLines(
  errors: Array<{ row: number; message: string }>,
  limit = 5,
): string {
  const lines = errors.slice(0, limit).map((row) => `Line ${row.row}: ${row.message}`);
  if (errors.length > limit) {
    lines.push(`…and ${errors.length - limit} more.`);
  }
  return lines.join(" ");
}

export function formatQuotedList(values: string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}
