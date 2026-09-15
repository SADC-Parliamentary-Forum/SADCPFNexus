/**
 * Pure helpers for workplan list multi-select bulk delete.
 * Side-effect free so unit tests can lock behaviour without React/DOM.
 */

export const WORKPLAN_BULK_DELETE_MAX = 500;

export function normalizeWorkplanEventIds(selectedIds: Array<number | string>): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const raw of selectedIds) {
    const id = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function chunkWorkplanEventIds(
  ids: number[],
  size: number = WORKPLAN_BULK_DELETE_MAX,
): number[][] {
  const chunkSize = Math.max(1, Math.floor(size));
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}
