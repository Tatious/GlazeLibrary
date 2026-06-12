/**
 * Glazes Page
 * List all glazes with ownership management
 */

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  useGlazes,
  useCombinations,
  useMyGlazes,
  useToggleGlazeOwned,
  useToggleGlazeFavorite,
} from "../hooks/useGlazeData";
import { useHistorySearch } from "../hooks/useHistorySearch";
import { useFilterStorage } from "../hooks/useFilterStorage";
import { useGridColumns, type ColumnMap } from "../hooks/useGridColumns";
import {
  useBatchSelect,
  useIsSelected,
  type SelectionStore,
} from "../hooks/useBatchSelect";
import { useAuth } from "../hooks/useAuth";
import {
  GlazeFilterBar,
  type GlazesBrandFilter,
  type GlazesOwnershipFilter,
  type GlazesSortOption,
} from "../components/glazes/GlazeFilterBar";
import { PageLayout } from "../components/PageLayout";
import { Spinner } from "../components/Spinner";
import { BatchAddBar } from "../components/BatchAddBar";
import { Check, Heart, Shop } from "../components/Icons";
import type { Glaze, MyGlazesConfig } from "../types/models";
import { getPrimaryImage } from "../utils/glazeUtils";
import { STORAGE_KEYS } from "../config/storageKeys";

export function GlazesPage() {
  const { data: glazes = [], isLoading: glazesLoading } = useGlazes();
  const { data: combinations = [] } = useCombinations();
  const myGlazes = useMyGlazes();
  const toggleOwned = useToggleGlazeOwned();
  const toggleFavorite = useToggleGlazeFavorite();
  // Auth gates: Select needs any signed-in user (it batch-adds to collections
  // or pieces, both of which require a user); the per-card Favorite button
  // needs a user too; the per-card Inventory button is admin-only since
  // inventory is a shared studio-wide list.
  const { user, isAdmin } = useAuth();

  const [search, setSearch] = useHistorySearch();
  const [ownershipFilter, setOwnershipFilter] =
    useFilterStorage<GlazesOwnershipFilter>(STORAGE_KEYS.GLAZE_FILTER, "owned");
  const [showFavoritesOnly, setShowFavoritesOnly] =
    useFilterStorage<boolean>(STORAGE_KEYS.GLAZE_FAVES, false);
  const [brandFilter, setBrandFilter] =
    useFilterStorage<GlazesBrandFilter>(STORAGE_KEYS.GLAZE_BRAND, "all");
  const [sortBy, setSortBy] =
    useFilterStorage<GlazesSortOption>(STORAGE_KEYS.GLAZE_SORT, "name");
  const [sortAsc, setSortAsc] =
    useFilterStorage<boolean>(STORAGE_KEYS.GLAZE_SORT_ASC, true);

  const batch = useBatchSelect();

  // No pinned-mode override: the default ownership filter is already "owned"
  // via useFilterStorage's seed, but a user pinned to a piece can still flip
  // to All / Unowned to add aspirational inspo — the backend doesn't gate
  // piece inspo on inventory.

  // Stable per-glaze callbacks for the memoized card. Wrapped with
  // `useCallback` so every <GlazeCard> sees identical handler refs across
  // renders — critical for `React.memo` to actually skip the ~600 cards we
  // aren't touching.
  const handleToggleOwned = useCallback(
    (glazeId: string) => {
      void toggleOwned(glazeId);
    },
    [toggleOwned],
  );
  const handleToggleFavorite = useCallback(
    (glazeId: string) => {
      void toggleFavorite(glazeId);
    },
    [toggleFavorite],
  );

  // Count combinations per glaze
  const combinationCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    combinations.forEach((combo) => {
      counts[combo.topGlaze.glazeId] =
        (counts[combo.topGlaze.glazeId] ?? 0) + 1;
      counts[combo.bottomGlaze.glazeId] =
        (counts[combo.bottomGlaze.glazeId] ?? 0) + 1;
    });

    return counts;
  }, [combinations]);

  // Filter and sort glazes
  const filteredGlazes = useMemo(() => {
    let result = [...glazes];

    // Text search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(searchLower) ||
          g.code.toLowerCase().includes(searchLower) ||
          g.series.toLowerCase().includes(searchLower),
      );
    }

    // Filter by brand (use brand field, case-insensitive)
    if (brandFilter !== "all") {
      result = result.filter((g) => {
        const brand = g.brand?.toLowerCase() || "";
        if (brandFilter === "sps") return brand.includes("seattle");
        return brand === brandFilter;
      });
    }

    // Filter by ownership status
    switch (ownershipFilter) {
      case "owned":
        result = result.filter((g) => myGlazes.glazes[g.id]?.owned);
        break;
      case "unowned":
        result = result.filter((g) => !myGlazes.glazes[g.id]?.owned);
        break;
    }

    // Filter by favorites
    if (showFavoritesOnly) {
      result = result.filter((g) => myGlazes.glazes[g.id]?.favorite);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "code":
          cmp = a.code.localeCompare(b.code);
          break;
        case "combinations":
          cmp = (combinationCounts[a.id] ?? 0) - (combinationCounts[b.id] ?? 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [
    glazes,
    search,
    brandFilter,
    ownershipFilter,
    showFavoritesOnly,
    sortBy,
    sortAsc,
    myGlazes,
    combinationCounts,
  ]);

  // Group by series
  const groupedGlazes = useMemo(() => {
    const groups: Record<string, Glaze[]> = {};
    filteredGlazes.forEach((glaze) => {
      const series = glaze.series || "Other";
      if (!groups[series]) {
        groups[series] = [];
      }
      groups[series].push(glaze);
    });
    return groups;
  }, [filteredGlazes]);

  if (glazesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner layout="inline" />
      </div>
    );
  }

  return (
    <>
      <GlazeFilterBar
        search={search}
        onSearchChange={setSearch}
        ownershipFilter={ownershipFilter}
        onOwnershipFilterChange={setOwnershipFilter}
        showFavoritesOnly={showFavoritesOnly}
        onShowFavoritesOnlyChange={setShowFavoritesOnly}
        brandFilter={brandFilter}
        onBrandFilterChange={setBrandFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortAsc={sortAsc}
        onSortAscChange={setSortAsc}
        resultCount={filteredGlazes.length}
        totalCount={glazes.length}
      />

      {/* Glaze list */}
      <PageLayout maxWidth="7xl" padY="6">
        {!batch.active && filteredGlazes.length > 0 && (
          <div className="flex items-center justify-end gap-2 mb-3">
            {/* Shop entry point. Lives next to Select so the two grid-level
                actions read as a unit. Hidden until the user owns at least
                one glaze \u2014 Shop ranks unowned glazes by how many new combos
                each unlocks, which needs an inventory baseline to be useful. */}
            <Link
              to="/glazes/shop"
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-moss-300 dark:border-moss-700 text-moss-700 dark:text-moss-300 hover:bg-moss-50 dark:hover:bg-moss-900/30 transition-colors flex items-center gap-1.5"
            >
              <Shop strokeWidth={1.75} />
              Shop
            </Link>
            {/* Select is the entry point for batch-adding glazes to a piece
                or collection. Both targets require a signed-in user, so the
                button is hidden for guests. */}
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
        {filteredGlazes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-clay-600 dark:text-clay-400">
              No glazes found matching your criteria.
            </p>
          </div>
        ) : (
          <VirtualizedGlazeGrid
            groupedGlazes={groupedGlazes}
            myGlazes={myGlazes}
            combinationCounts={combinationCounts}
            batchActive={batch.active}
            selectionStore={batch.store}
            showFavoriteBtn={!!user}
            showInventoryBtn={isAdmin}
            onToggleFavorite={handleToggleFavorite}
            onToggleOwned={handleToggleOwned}
          />
        )}
      </PageLayout>

      {batch.active && (
        <BatchAddBar
          store={batch.store}
          itemType="glaze"
          pinned={batch.pinned}
          onCancel={batch.cancel}
          onAdded={batch.store.clear}
          onClearPinned={batch.clearPinned}
        />
      )}
    </>
  );
}

// ============================================================================
// GlazeCard — memoized so toggling selection on one card doesn't re-render
// the other ~600 cards in the grid. All props are stable refs (callbacks
// are `useCallback`'d in the parent, glaze objects come from React Query
// and don't change identity between renders).
// ============================================================================

interface GlazeCardProps {
  glaze: Glaze;
  isOwned: boolean;
  isFavorite: boolean;
  comboCount: number;
  thumbnail: string | null | undefined;
  batchActive: boolean;
  selectionStore: SelectionStore;
  showFavoriteBtn: boolean;
  showInventoryBtn: boolean;
  onToggleFavorite: (id: string) => void;
  onToggleOwned: (id: string) => void;
}

const GlazeCard = memo(function GlazeCard({
  glaze,
  isOwned,
  isFavorite,
  comboCount,
  thumbnail,
  batchActive,
  selectionStore,
  showFavoriteBtn,
  showInventoryBtn,
  onToggleFavorite,
  onToggleOwned,
}: GlazeCardProps) {
  // In selection mode the card is a selection target. We render a
  // dedicated subcomponent so it can subscribe to ONLY its own
  // selection key \u2014 toggling one card never re-renders the others.
  if (batchActive) {
    return (
      <SelectableGlazeCard
        glaze={glaze}
        thumbnail={thumbnail}
        comboCount={comboCount}
        store={selectionStore}
      />
    );
  }

  const cardClass = `group bg-white dark:bg-earth-800 rounded-xl overflow-hidden border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
    isOwned
      ? "border-moss-300 dark:border-moss-700 hover:border-moss-400 dark:hover:border-moss-600"
      : "border-sage-100 dark:border-earth-600 hover:border-sage-300 dark:hover:border-sage-700"
  }`;

  return (
    <div className={`relative ${cardClass}`}>
      {/* Thumbnail */}
      <Link to={`/glaze/${glaze.id}`} className="block">
        {thumbnail ? (
          <div className="aspect-square bg-clay-100 dark:bg-earth-700 overflow-hidden">
            <img
              src={thumbnail}
              alt={glaze.displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>
        ) : (
          <div className="aspect-square bg-gradient-to-br from-clay-200 to-clay-300 dark:from-earth-700 dark:to-earth-600 flex items-center justify-center">
            <span className="text-4xl font-bold text-clay-400 dark:text-earth-500">
              {glaze.code.split("-")[0]}
            </span>
          </div>
        )}
      </Link>

      <div className="p-3">
        <div className="flex-1 min-w-0">
          <Link
            to={`/glaze/${glaze.id}`}
            className="block hover:text-moss-600 dark:hover:text-moss-400 transition-colors"
          >
            <h3 className="font-medium text-clay-800 dark:text-clay-100 truncate">
              {glaze.name}
            </h3>
          </Link>
          <p className="text-sm text-clay-600 dark:text-clay-400">
            {glaze.code}
          </p>
          <p className="text-xs text-clay-500 dark:text-clay-500 mt-1">
            Cone {glaze.cone.join("/")}
          </p>
        </div>
        <div className="flex items-end justify-between mt-1">
          <p className="text-xs text-clay-500 dark:text-clay-500">
            {comboCount} combo{comboCount !== 1 ? "s" : ""}
          </p>
          {(showFavoriteBtn || showInventoryBtn) && (
            <div className="flex gap-1 ml-2">
              {showFavoriteBtn && (
                <button
                  onClick={() => onToggleFavorite(glaze.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isFavorite
                      ? "bg-terracotta-100 text-terracotta-600 dark:bg-terracotta-900 dark:text-terracotta-400"
                      : "bg-clay-100 text-clay-500 hover:bg-clay-200 hover:text-clay-600 dark:bg-earth-700 dark:text-clay-400 dark:hover:bg-earth-600"
                  }`}
                  title={
                    isFavorite ? "Remove from favorites" : "Add to favorites"
                  }
                >
                  <Heart filled={isFavorite} />
                </button>
              )}
              {showInventoryBtn && (
                <button
                  onClick={() => onToggleOwned(glaze.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isOwned
                      ? "bg-moss-100 text-moss-600 dark:bg-moss-900 dark:text-moss-400"
                      : "bg-clay-100 text-clay-400 hover:bg-clay-200 dark:bg-earth-700 dark:hover:bg-earth-600"
                  }`}
                  title={isOwned ? "Remove from owned" : "Mark as owned"}
                >
                  <Check />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// SelectableGlazeCard
// Only subscribes when select mode is active. A toggle on this card flips
// its own key in the store, which notifies only this subscriber \u2014 so the
// other ~600 cards in the grid don't reconcile.
// ============================================================================

interface SelectableGlazeCardProps {
  glaze: Glaze;
  thumbnail: string | null | undefined;
  comboCount: number;
  store: SelectionStore;
}

function SelectableGlazeCard({
  glaze,
  thumbnail,
  comboCount,
  store,
}: SelectableGlazeCardProps) {
  const selectionKey = `glaze:${glaze.id}`;
  const isSelected = useIsSelected(store, selectionKey);

  const cardClass = `bg-white dark:bg-earth-800 rounded-xl overflow-hidden border-2 transition-colors cursor-pointer touch-manipulation ${
    isSelected
      ? "border-terracotta-500 dark:border-terracotta-400 ring-2 ring-terracotta-300/60 dark:ring-terracotta-700/60"
      : "border-sage-100 dark:border-earth-600 hover:border-sage-300 dark:hover:border-sage-700"
  }`;

  const onToggle = () => store.toggle(selectionKey);

  return (
    <div
      className={`relative ${cardClass}`}
      onClick={onToggle}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div
        className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md pointer-events-none transition-colors ${
          isSelected
            ? "bg-terracotta-500 text-white"
            : "bg-white/85 dark:bg-earth-900/85 text-clay-400 dark:text-earth-500 backdrop-blur-sm"
        }`}
        aria-hidden="true"
      >
        {isSelected ? (
          <Check size="lg" strokeWidth={3} />
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-current" />
        )}
      </div>
      {thumbnail ? (
        <div className="aspect-square bg-clay-100 dark:bg-earth-700 overflow-hidden">
          <img
            src={thumbnail}
            alt={glaze.displayName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-clay-200 to-clay-300 dark:from-earth-700 dark:to-earth-600 flex items-center justify-center">
          <span className="text-4xl font-bold text-clay-400 dark:text-earth-500">
            {glaze.code.split("-")[0]}
          </span>
        </div>
      )}
      <div className="p-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-clay-800 dark:text-clay-100 truncate">
            {glaze.name}
          </h3>
          <p className="text-sm text-clay-600 dark:text-clay-400">
            {glaze.code}
          </p>
          <p className="text-xs text-clay-500 dark:text-clay-500 mt-1">
            Cone {glaze.cone.join("/")}
          </p>
        </div>
        <div className="flex items-end justify-between mt-1">
          <p className="text-xs text-clay-500 dark:text-clay-500">
            {comboCount} combo{comboCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VirtualizedGlazeGrid
// Flattens the series-grouped glazes into a single list of "rows" (header
// or card-row) and feeds them to `useWindowVirtualizer`, so only the rows
// in the viewport ( + overscan) are mounted. With ~650 glazes this drops
// the DOM from ~650 cards to ~10\u201320 at any time, and makes filter/sort
// reflows cheap.
// ============================================================================

type FlatRow =
  | { kind: "header"; series: string; count: number }
  | { kind: "cards"; glazes: Glaze[] };

interface VirtualizedGlazeGridProps {
  groupedGlazes: Record<string, Glaze[]>;
  myGlazes: MyGlazesConfig;
  combinationCounts: Record<string, number>;
  batchActive: boolean;
  selectionStore: SelectionStore;
  showFavoriteBtn: boolean;
  showInventoryBtn: boolean;
  onToggleFavorite: (id: string) => void;
  onToggleOwned: (id: string) => void;
}

// Column tiers for the virtualized glaze grid:
//   base → 2  (mobile portrait, smallest)
//   xs   → 3  (>=480w portrait)
//   xsl  → 4  (landscape phone)
//   lg   → 4  (>=1024w)
//   xl   → 5  (>=1280w)
//   2xl  → 6  (>=1536w)
const COLS: ColumnMap = { base: 2, xs: 3, xsl: 4, lg: 4, xl: 5, "2xl": 6 };

function VirtualizedGlazeGrid({
  groupedGlazes,
  myGlazes,
  combinationCounts,
  batchActive,
  selectionStore,
  showFavoriteBtn,
  showInventoryBtn,
  onToggleFavorite,
  onToggleOwned,
}: VirtualizedGlazeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useGridColumns(COLS);

  // Flatten groups → [header, row, row, ..., header, row, row, ...]. Card
  // rows are chunked by `columnCount` so each row is one CSS grid line.
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const [series, list] of Object.entries(groupedGlazes).sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      rows.push({ kind: "header", series, count: list.length });
      for (let i = 0; i < list.length; i += columnCount) {
        rows.push({ kind: "cards", glazes: list.slice(i, i + columnCount) });
      }
    }
    return rows;
  }, [groupedGlazes, columnCount]);

  const rowVirtualizer = useWindowVirtualizer({
    count: flatRows.length,
    estimateSize: useCallback(
      (index: number) => (flatRows[index]?.kind === "header" ? 56 : 300),
      [flatRows],
    ),
    overscan: 4,
    gap: 16,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  });

  // When columnCount changes, the per-row layout changes — re-measure so
  // estimates don't drift while the virtualizer is rebuilding rows.
  useEffect(() => {
    rowVirtualizer.measure();
  }, [columnCount, rowVirtualizer]);

  const totalSize = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();
  const scrollOffset = rowVirtualizer.options.scrollMargin;

  return (
    <div
      ref={containerRef}
      style={{
        height: `${totalSize}px`,
        width: "100%",
        position: "relative",
      }}
    >
      {virtualItems.map((virtualRow) => {
        const row = flatRows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - scrollOffset}px)`,
            }}
          >
            {row.kind === "header" ? (
              <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100 pt-4 pb-2">
                {row.series}
                <span className="ml-2 text-sm font-normal text-clay-500 dark:text-clay-500">
                  ({row.count})
                </span>
              </h2>
            ) : (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                }}
              >
                {row.glazes.map((glaze) => (
                  <GlazeCard
                    key={glaze.id}
                    glaze={glaze}
                    isOwned={myGlazes.glazes[glaze.id]?.owned ?? false}
                    isFavorite={
                      myGlazes.glazes[glaze.id]?.favorite ?? false
                    }
                    comboCount={combinationCounts[glaze.id] ?? 0}
                    thumbnail={getPrimaryImage(glaze)}
                    batchActive={batchActive}
                    selectionStore={selectionStore}
                    showFavoriteBtn={showFavoriteBtn}
                    showInventoryBtn={showInventoryBtn}
                    onToggleFavorite={onToggleFavorite}
                    onToggleOwned={onToggleOwned}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

