"use client";

import { useCallback, useMemo, useState } from "react";

export type RowId = number | string;

export interface UseRowSelectionOptions<T> {
  /** Rows currently eligible for selection (e.g. current page or filtered set). */
  rows: T[];
  getId: (row: T) => RowId;
  /** Return false to disable checkbox for a row. */
  canSelect?: (row: T) => boolean;
}

export function useRowSelection<T>({ rows, getId, canSelect }: UseRowSelectionOptions<T>) {
  const [selected, setSelected] = useState<Set<RowId>>(new Set());

  const selectableIds = useMemo(() => {
    return rows.filter((row) => (canSelect ? canSelect(row) : true)).map(getId);
  }, [rows, getId, canSelect]);

  const selectableIdSet = useMemo(() => new Set(selectableIds), [selectableIds]);

  const selectedCount = selected.size;
  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelectableSelected = selectableIds.some((id) => selected.has(id));

  const isSelected = useCallback((id: RowId) => selected.has(id), [selected]);

  const toggle = useCallback((id: RowId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllSelectable = useCallback(() => {
    setSelected((prev) => {
      const allOn = selectableIds.length > 0 && selectableIds.every((id) => prev.has(id));
      if (allOn) {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }, [selectableIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedIds = useMemo(() => [...selected], [selected]);

  /** Keep selection only for ids that are still selectable (optional prune). */
  const pruneToSelectable = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<RowId>();
      prev.forEach((id) => {
        if (selectableIdSet.has(id)) next.add(id);
      });
      return next;
    });
  }, [selectableIdSet]);

  return {
    selected,
    selectedIds,
    selectedCount,
    selectableIds,
    allSelectableSelected,
    someSelectableSelected,
    isSelected,
    toggle,
    toggleAllSelectable,
    clear,
    setSelected,
    pruneToSelectable,
  };
}
