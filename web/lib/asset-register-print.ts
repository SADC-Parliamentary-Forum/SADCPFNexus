/** A4 width in millimetres. Landscape is required so the register table fits. */
export const A4_PORTRAIT_WIDTH_MM = 210;
export const A4_LANDSCAPE_WIDTH_MM = 297;
export const REGISTER_PDF_MARGIN_MM = 10;

export const REGISTER_PDF_COLUMNS = [
  { key: "asset_code", header: "Code", weight: 18 },
  { key: "name", header: "Name", weight: 28 },
  { key: "category", header: "Category", weight: 14 },
  { key: "status", header: "Status", weight: 16 },
  { key: "assigned", header: "Assigned to", weight: 24 },
] as const;

export type RegisterPdfColumnKey = (typeof REGISTER_PDF_COLUMNS)[number]["key"];

export function registerPdfAvailableWidth(
  pageWidthMm: number,
  marginMm = REGISTER_PDF_MARGIN_MM,
): number {
  return Math.max(40, pageWidthMm - marginMm * 2);
}

/**
 * Column widths that always sum to the printable area.
 * Autotable v5 throws if wrap-width exceeds the page ("X units width could not fit page").
 */
export function registerPdfColumnWidths(
  pageWidthMm: number,
  marginMm = REGISTER_PDF_MARGIN_MM,
): number[] {
  const available = registerPdfAvailableWidth(pageWidthMm, marginMm);
  const totalWeight = REGISTER_PDF_COLUMNS.reduce((sum, col) => sum + col.weight, 0);
  const widths = REGISTER_PDF_COLUMNS.map((col) =>
    Math.floor(((available * col.weight) / totalWeight) * 100) / 100,
  );
  const used = widths.reduce((sum, w) => sum + w, 0);
  widths[widths.length - 1] = Math.round((available - (used - widths[widths.length - 1])) * 100) / 100;
  return widths;
}

export function registerPdfTableFitsPage(
  columnWidths: number[],
  pageWidthMm: number,
  marginMm = REGISTER_PDF_MARGIN_MM,
): boolean {
  const available = registerPdfAvailableWidth(pageWidthMm, marginMm);
  const sum = columnWidths.reduce((total, width) => total + width, 0);
  return sum <= available + 0.05;
}

export function resolveExportAssets<T extends { id: number }>(
  filtered: T[],
  selectedIds: Iterable<number | string>,
): T[] {
  const selected = [...selectedIds]
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (selected.length === 0) return filtered;
  const want = new Set(selected);
  return filtered.filter((row) => want.has(row.id));
}

export function parsePrintAssetIds(search: string): number[] {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("ids");
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function printPageHref(ids: number[]): string {
  if (ids.length === 0) return "/assets/print";
  return `/assets/print?ids=${ids.join(",")}`;
}

export type RegisterExportFilters = {
  status?: string;
  category?: string;
  search?: string;
};

export function registerExportQuery(
  ids: number[],
  filters?: RegisterExportFilters,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    format: "xlsx",
    include_pending: 1,
  };
  if (ids.length > 0) {
    params.ids = ids.join(",");
    return params;
  }
  if (filters?.status && filters.status !== "all") params.status = filters.status;
  if (filters?.category && filters.category !== "all") params.category = filters.category;
  const search = filters?.search?.trim();
  if (search) params.search = search;
  return params;
}

export type PaginatedSlice<T> = { data: T[]; last_page?: number };

/** Walk Laravel-style pages until last_page so print/export is not capped at 100. */
export async function collectPaginatedRows<T>(
  fetchPage: (page: number) => Promise<PaginatedSlice<T>>,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const slice = await fetchPage(page);
    const rows = slice.data ?? [];
    all.push(...rows);
    const last = Math.max(1, Number(slice.last_page) || page);
    if (page >= last || rows.length === 0) break;
  }
  return all;
}
