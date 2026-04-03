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

/**
 * Exports an array of row objects to an Excel-compatible XML Spreadsheet (.xls).
 * No external dependency required — Excel, LibreOffice and Google Sheets all open this format.
 */
export function exportToXls(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: { key: string; header: string }[]
): void {
  if (rows.length === 0 && !columns) return;

  const resolvedColumns: { key: string; header: string }[] =
    columns && columns.length > 0
      ? columns
      : Object.keys(rows[0] ?? {}).map((key) => ({ key, header: key }));

  if (resolvedColumns.length === 0) return;

  const xmlEsc = (v: unknown): string =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const headerRow = resolvedColumns
    .map((c) => `<Cell ss:StyleID="h"><Data ss:Type="String">${xmlEsc(c.header)}</Data></Cell>`)
    .join("");

  const dataRows = rows
    .map((row) => {
      const cells = resolvedColumns
        .map((c) => {
          const v = row[c.key];
          const type = typeof v === "number" ? "Number" : "String";
          return `<Cell><Data ss:Type="${type}">${xmlEsc(v)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="h">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#1d85ed" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Risk Register">
    <Table>
      <Row>${headerRow}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
