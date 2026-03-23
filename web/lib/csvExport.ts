/**
 * Escapes a single CSV cell value.
 * Values containing commas, double-quotes, or newlines are wrapped in double
 * quotes; any internal double-quote characters are doubled per RFC 4180.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const str = String(value);

  // Wrap in quotes if the value contains a comma, double-quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Exports an array of row objects to a CSV file and triggers a browser download.
 *
 * @param filename  The name of the downloaded file (`.csv` appended if absent).
 * @param rows      Array of plain objects whose values will form the CSV rows.
 * @param columns   Optional column definitions. When provided, only the listed
 *                  keys are exported, in the given order, using the supplied
 *                  header labels. When omitted, headers and order are inferred
 *                  from the keys of the first row.
 */
export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: { key: string; header: string }[]
): void {
  if (rows.length === 0 && !columns) return;

  // Resolve column definitions
  const resolvedColumns: { key: string; header: string }[] =
    columns && columns.length > 0
      ? columns
      : Object.keys(rows[0] ?? {}).map((key) => ({ key, header: key }));

  if (resolvedColumns.length === 0) return;

  // Build CSV lines
  const headerLine = resolvedColumns.map((col) => escapeCell(col.header)).join(",");

  const dataLines = rows.map((row) =>
    resolvedColumns.map((col) => escapeCell(row[col.key])).join(",")
  );

  const csvContent = [headerLine, ...dataLines].join("\r\n");

  // Trigger browser download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the object URL after a short delay to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
