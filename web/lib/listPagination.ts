/**
 * Shared list/register pagination helpers.
 *
 * Prefer server pagination when the API returns `last_page` / `current_page`.
 * Fall back to client-side slicing when the endpoint returns a flat array
 * (or a large unpaginated dump).
 */

export const DEFAULT_PAGE_SIZE = 25;

export function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

export function getLastPage(payload: unknown): number {
  if (payload && typeof payload === "object" && "last_page" in payload) {
    const n = Number((payload as { last_page?: unknown }).last_page);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

export function getTotal(payload: unknown, fallbackLength = 0): number {
  if (payload && typeof payload === "object" && "total" in payload) {
    const n = Number((payload as { total?: unknown }).total);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallbackLength;
}

export function clientPageCount(totalItems: number, pageSize = DEFAULT_PAGE_SIZE): number {
  if (totalItems <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function slicePage<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE): T[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
