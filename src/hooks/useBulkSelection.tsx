import { useState, useCallback } from "react";

export function useBulkSelection<T extends { id: string }>() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const isAllSelected = useCallback(
    (items: T[]) => items.length > 0 && selectedIds.size === items.length,
    [selectedIds]
  );

  const isIndeterminate = useCallback(
    (items: T[]) => selectedIds.size > 0 && selectedIds.size < items.length,
    [selectedIds]
  );

  const toggleAll = useCallback(
    (items: T[]) => {
      if (isAllSelected(items)) {
        clearSelection();
      } else {
        selectAll(items);
      }
    },
    [isAllSelected, clearSelection, selectAll]
  );

  const getSelectedItems = useCallback(
    (items: T[]) => items.filter((item) => selectedIds.has(item.id)),
    [selectedIds]
  );

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggleAll,
    getSelectedItems,
  };
}