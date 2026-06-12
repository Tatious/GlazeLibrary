/**
 * Glaze Combinations Page
 * Shows all combinations involving a specific glaze (either as top or bottom)
 */

import { useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useGlaze, useCombinations, useMyGlazes } from "../hooks/useGlazeData";
import { useHistorySearch } from "../hooks/useHistorySearch";
import { CombinationGrid } from "../components/CombinationGrid";
import { SearchInput } from "../components/SearchInput";
import { PageLayout } from "../components/PageLayout";
import { SkeletonHeader, SkeletonGrid } from "../components/Skeleton";
import { Check } from "../components/Icons";
import { getPrimaryImage } from "../utils/glazeUtils";

type PositionFilter = "all" | "top" | "bottom";

export function GlazeCombinationsPage() {
  const { id: glazeId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: glaze, isLoading: glazeLoading } = useGlaze(glazeId || "");
  const { data: allCombinations = [], isLoading: combosLoading } =
    useCombinations();
  const myGlazes = useMyGlazes();

  // Filter state from URL params
  const positionFilter =
    (searchParams.get("position") as PositionFilter) || "all";
  const onlyOwned = searchParams.get("owned") !== "false"; // Default to true (only owned glazes)

  // Search state - uses history state for back-navigation restoration only
  const [search, setSearch] = useHistorySearch();

  const isLoading = glazeLoading || combosLoading;

  // Get owned glaze IDs
  const ownedGlazeIds = useMemo(() => {
    return new Set(
      Object.entries(myGlazes.glazes)
        .filter(([, entry]) => entry.owned)
        .map(([id]) => id),
    );
  }, [myGlazes.glazes]);

  // Filter combinations for this glaze
  const filteredCombinations = useMemo(() => {
    if (!glazeId) return [];

    let filtered = allCombinations.filter((combo) => {
      const isTop = combo.topGlaze.glazeId === glazeId;
      const isBottom = combo.bottomGlaze.glazeId === glazeId;

      // Must involve this glaze
      if (!isTop && !isBottom) return false;

      // Position filter
      if (positionFilter === "top" && !isTop) return false;
      if (positionFilter === "bottom" && !isBottom) return false;

      // Only owned filter - check if user owns the OTHER glaze
      if (onlyOwned) {
        const otherGlazeId = isTop
          ? combo.bottomGlaze.glazeId
          : combo.topGlaze.glazeId;
        if (!ownedGlazeIds.has(otherGlazeId)) return false;
      }

      return true;
    });

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((combo) => {
        const otherGlaze =
          combo.topGlaze.glazeId === glazeId
            ? combo.bottomGlaze
            : combo.topGlaze;
        return (
          otherGlaze.displayName.toLowerCase().includes(searchLower) ||
          combo.topGlaze.displayName.toLowerCase().includes(searchLower) ||
          combo.bottomGlaze.displayName.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [
    allCombinations,
    glazeId,
    positionFilter,
    onlyOwned,
    ownedGlazeIds,
    search,
  ]);

  // Stats
  const stats = useMemo(() => {
    if (!glazeId) return { total: 0, asTop: 0, asBottom: 0, withOwned: 0 };

    const combosForGlaze = allCombinations.filter(
      (c) =>
        c.topGlaze.glazeId === glazeId || c.bottomGlaze.glazeId === glazeId,
    );

    return {
      total: combosForGlaze.length,
      asTop: combosForGlaze.filter((c) => c.topGlaze.glazeId === glazeId)
        .length,
      asBottom: combosForGlaze.filter((c) => c.bottomGlaze.glazeId === glazeId)
        .length,
      withOwned: combosForGlaze.filter((c) => {
        const otherGlazeId =
          c.topGlaze.glazeId === glazeId
            ? c.bottomGlaze.glazeId
            : c.topGlaze.glazeId;
        return ownedGlazeIds.has(otherGlazeId);
      }).length,
    };
  }, [allCombinations, glazeId, ownedGlazeIds]);

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === null || value === "all") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams, { replace: true });
  };

  if (isLoading) {
    return (
      <PageLayout maxWidth="7xl" padY="8">
        <SkeletonHeader />
        <SkeletonGrid count={8} shape="image" cols={4} className="mt-8" />
      </PageLayout>
    );
  }

  if (!glaze) {
    return (
      <PageLayout maxWidth="7xl" padY="8">
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-2">
            Glaze Not Found
          </h1>
          <Link to="/glazes" className="text-terracotta-600 hover:underline">
            ← Back to Glazes
          </Link>
        </div>
      </PageLayout>
    );
  }

  const thumbnail = getPrimaryImage(glaze);

  return (
    <PageLayout maxWidth="7xl" padY="8">
      {/* Header with glaze info */}
      <div className="mb-6">
        <Link
          to={`/glaze/${glaze.id}`}
          className="inline-flex items-center gap-4 group"
        >
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={glaze.displayName}
              className="w-16 h-16 object-cover rounded-lg"
            />
          ) : (
            <div className="w-16 h-16 bg-clay-200 dark:bg-earth-700 rounded-lg flex items-center justify-center">
              <span className="text-clay-400 text-2xl">🎨</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 transition-colors">
              {glaze.displayName} Combinations
            </h1>
            <p className="text-sm text-clay-600 dark:text-clay-400">
              {glaze.brand} · {glaze.series}
            </p>
          </div>
        </Link>
      </div>

      {/* Filter bar — mirrors the FilterBar / GlazeFilterBar skeleton: full
          search row on top, facet pills below, then a result count footer.
          That way the three combo-grid surfaces (/combinations,
          /glazes/shop, /glaze/:id/combinations) all feel like siblings. */}
      <div className="bg-clay-100 dark:bg-earth-800 border-2 border-clay-300 dark:border-earth-600 rounded-xl mb-6">
        <div className="p-4">
          {/* Search — full width on its own row, mirroring the other bars. */}
          <div className="mb-3">
            <SearchInput
              placeholder="Search combinations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-clay-50 dark:bg-earth-700"
            />
          </div>

          {/* Facet pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Position — segmented button group, neutral selected color so it
                doesn't fight the brand-colored pills next to it. */}
            <div className="inline-flex rounded-lg border border-clay-300 dark:border-earth-500 overflow-hidden">
              {([
                { value: "all" as const, label: `All (${stats.total})` },
                { value: "top" as const, label: `Top (${stats.asTop})` },
                { value: "bottom" as const, label: `Bottom (${stats.asBottom})` },
              ]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateFilter("position", value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    positionFilter === value
                      ? "bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200"
                      : "bg-clay-50 text-clay-700 dark:bg-earth-700 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Owned filter — only meaningful when the user has any inventory. */}
            {ownedGlazeIds.size > 0 && (
              <button
                onClick={() => updateFilter("owned", onlyOwned ? "false" : null)}
                className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 border ${
                  onlyOwned
                    ? "bg-sage-100 text-sage-700 border-sage-400 dark:bg-sage-900 dark:text-sage-300 dark:border-sage-500"
                    : "bg-clay-50 text-clay-600 border-clay-300 dark:bg-earth-700 dark:text-clay-400 dark:border-earth-500 hover:bg-clay-100 hover:border-clay-400 dark:hover:bg-earth-600"
                }`}
              >
                {onlyOwned && <Check />}
                Only with owned glazes ({stats.withOwned})
              </button>
            )}
          </div>

          {/* Footer: result count. */}
          <div className="mt-3 text-sm text-clay-600 dark:text-clay-400">
            <span className="font-semibold text-clay-800 dark:text-clay-200">
              {filteredCombinations.length}
            </span>{" "}
            of {stats.total} combinations
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredCombinations.length === 0 ? (
        <div className="text-center py-12 text-clay-500 dark:text-clay-400">
          No combinations found matching your criteria.
        </div>
      ) : (
        <CombinationGrid combinations={filteredCombinations} />
      )}
    </PageLayout>
  );
}
