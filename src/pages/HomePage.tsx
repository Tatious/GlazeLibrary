/**
 * Home Page - Main combination grid view
 */

import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FilterBar } from "../components/FilterBar";
import { CombinationGrid } from "../components/CombinationGrid";
import { PageLayout } from "../components/PageLayout";
import { BatchAddBar } from "../components/BatchAddBar";
import {
  useFilteredCombinations,
  useCombinations,
  useMyGlazes,
} from "../hooks/useGlazeData";
import { useHistorySearch } from "../hooks/useHistorySearch";
import { useFilterStorage } from "../hooks/useFilterStorage";
import { useBatchSelect } from "../hooks/useBatchSelect";
import { useAuth } from "../hooks/useAuth";
import type { CombinationFilters } from "../types/models";
import { STORAGE_KEYS } from "../config/storageKeys";
import { Sparkles } from "../components/Icons";
import { startSurpriseJourney } from "../utils/surpriseJourney";

type BaseFilters = Omit<CombinationFilters, "search">;

// Default to owned-only; the rest of the filter state is whatever the
// user left behind last time.
const DEFAULT_BASE_FILTERS: BaseFilters = { ownership: "owned" };

export function HomePage() {
  const navigate = useNavigate();
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
  const myGlazes = useMyGlazes();

  // Surprise is a recommendation, so it remains inventory-only even when the
  // visible grid is temporarily set to All or Unowned. Shop is the one place
  // where the app intentionally recommends glazes the studio does not own.
  const randomizableCombinations = useMemo(
    () =>
      (filteredCombinations ?? []).filter(
        (combo) =>
          (myGlazes.glazes[combo.topGlaze.glazeId]?.owned ?? false) &&
          (myGlazes.glazes[combo.bottomGlaze.glazeId]?.owned ?? false),
      ),
    [filteredCombinations, myGlazes.glazes],
  );

  const handleRandomCombination = () => {
    const next = startSurpriseJourney(
      "combination",
      randomizableCombinations.map((combo) => combo.id),
    );
    if (!next) return;
    navigate(`/combination/${next.id}`, {
      state: { surprise: next.journey },
    });
  };

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
        {!batch.active && (filteredCombinations?.length ?? 0) > 0 && (
          <div className="flex items-center justify-end gap-2 mb-3">
            {randomizableCombinations.length > 0 && (
              <button
                type="button"
                onClick={handleRandomCombination}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-terracotta-300 dark:border-terracotta-700 text-terracotta-700 dark:text-terracotta-300 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/30 transition-colors flex items-center gap-1.5"
                title={`Pick a random owned combination from these ${randomizableCombinations.length} results`}
              >
                <Sparkles strokeWidth={1.75} />
                Surprise me
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={batch.enable}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-200 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
              >
                Select
              </button>
            )}
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
