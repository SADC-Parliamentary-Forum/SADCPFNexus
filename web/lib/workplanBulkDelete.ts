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

export function dropSelectedIds(
  selected: Iterable<number | string>,
  idsToDrop: Iterable<number | string>,
): Set<number | string> {
  const drop = new Set<number | string>([...idsToDrop]);
  const next = new Set<number | string>();
  for (const id of selected) {
    if (!drop.has(id)) next.add(id);
  }
  return next;
}

export type WorkplanBulkDeleteSummary =
  | { kind: "success"; deleted: number }
  | { kind: "partial"; deleted: number }
  | { kind: "failure"; deleted: 0 };

export function summarizeWorkplanBulkDelete(
  deleted: number,
  failed: boolean,
): WorkplanBulkDeleteSummary {
  if (!failed) return { kind: "success", deleted };
  if (deleted > 0) return { kind: "partial", deleted };
  return { kind: "failure", deleted: 0 };
}
