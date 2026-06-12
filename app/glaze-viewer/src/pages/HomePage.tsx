/**
 * Home Page - Main combination grid view
 */

import { useCallback } from "react";
import { FilterBar } from "../components/FilterBar";
import { CombinationGrid } from "../components/CombinationGrid";
import { PageLayout } from "../components/PageLayout";
import { BatchAddBar } from "../components/BatchAddBar";
import {
  useFilteredCombinations,
  useCombinations,
} from "../hooks/useGlazeData";
import { useHistorySearch } from "../hooks/useHistorySearch";
import { useFilterStorage } from "../hooks/useFilterStorage";
import { useBatchSelect } from "../hooks/useBatchSelect";
import { useAuth } from "../hooks/useAuth";
import type { CombinationFilters } from "../types/models";
import { STORAGE_KEYS } from "../config/storageKeys";

type BaseFilters = Omit<CombinationFilters, "search">;

// Default to owned-only; the rest of the filter state is whatever the
// user left behind last time.
const DEFAULT_BASE_FILTERS: BaseFilters = { ownership: "owned" };

export function HomePage() {
  const [historySearch, setHistorySearch] = useHistorySearch();
  const [baseFilters, setBaseFilters] = useFilterStorage<BaseFilters>(
    STORAGE_KEYS.COMBO_FILTERS,
    DEFAULT_BASE_FILTERS,
  );

  const filters: CombinationFilters = {
    ...baseFilters,
    search: historySearch || undefined,
  };

  const handleFiltersChange = useCallback(
    (newFilters: CombinationFilters) => {
      const { search, ...rest } = newFilters;
      setHistorySearch(search || "");
      setBaseFilters(rest);
    },
    [setHistorySearch, setBaseFilters],
  );

  const batch = useBatchSelect();

  // Select \u2192 batch-add to a piece/collection, both of which need a user.
  const { user } = useAuth();

  // No pinned-mode override: the default filter is already "owned" via
  // useFilterStorage's seed, but a user pinned to a piece can still flip
  // to All / Unowned to add aspirational inspo — the backend doesn't gate
  // piece inspo on inventory.

  const { data: allCombinations } = useCombinations();
  const { data: filteredCombinations } = useFilteredCombinations(filters);

  return (
    <>
      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={filteredCombinations?.length ?? 0}
        totalCount={allCombinations?.length ?? 0}
      />

      {/* Grid */}
      <PageLayout maxWidth="7xl" padY="6">
        {!batch.active && user && (filteredCombinations?.length ?? 0) > 0 && (
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={batch.enable}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-200 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
            >
              Select
            </button>
          </div>
        )}
        <CombinationGrid
          combinations={filteredCombinations ?? []}
          selectionMode={batch.active}
          selectionStore={batch.store}
        />
      </PageLayout>

      {batch.active && (
        <BatchAddBar
          store={batch.store}
          itemType="combination"
          pinned={batch.pinned}
          onCancel={batch.cancel}
          onAdded={batch.store.clear}
          onClearPinned={batch.clearPinned}
        />
      )}
    </>
  );
}
