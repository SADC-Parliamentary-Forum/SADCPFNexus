/**
 * Pure helpers for contract-settings multi-select activate / deactivate.
 * Side-effect free so unit tests can lock behaviour without React/DOM.
 */

export type SettingsSelectable = {
  id: number;
  is_active: boolean;
  is_default?: boolean;
};

export function normalizeSettingsIds(selectedIds: Array<number | string>): number[] {
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

export function selectedSettingsRows<T extends SettingsSelectable>(
  rows: T[],
  selectedIds: Array<number | string>,
): T[] {
  const wanted = new Set(normalizeSettingsIds(selectedIds));
  return rows.filter((row) => wanted.has(row.id));
}

export function settingsIdsToDeactivate<T extends SettingsSelectable>(
  rows: T[],
  selectedIds: Array<number | string>,
): number[] {
  return selectedSettingsRows(rows, selectedIds)
    .filter((row) => row.is_active && !row.is_default)
    .map((row) => row.id);
}

export function settingsIdsToActivate<T extends SettingsSelectable>(
  rows: T[],
  selectedIds: Array<number | string>,
): number[] {
  return selectedSettingsRows(rows, selectedIds)
    .filter((row) => !row.is_active)
    .map((row) => row.id);
}

export type SettingsBulkSummary = {
  kind: "success" | "partial" | "failure";
  succeeded: number;
  failed: number;
};

export function summarizeSettingsBulk(succeeded: number, failed: number): SettingsBulkSummary {
  if (failed <= 0) return { kind: "success", succeeded, failed: 0 };
  if (succeeded > 0) return { kind: "partial", succeeded, failed };
  return { kind: "failure", succeeded: 0, failed };
}
