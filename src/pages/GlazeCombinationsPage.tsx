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

  // Filter combinations for this glaze in three stages, so the empty state can
  // tell *which* filter emptied the grid (position → owned → search) instead of
  // a dead-end "no results".

  // 1. Combos involving this glaze, narrowed by the position facet only.
  const positionCombos = useMemo(() => {
    if (!glazeId) return [];
    return allCombinations.filter((combo) => {
      const isTop = combo.topGlaze.glazeId === glazeId;
      const isBottom = combo.bottomGlaze.glazeId === glazeId;
      if (!isTop && !isBottom) return false;
      if (positionFilter === "top" && !isTop) return false;
      if (positionFilter === "bottom" && !isBottom) return false;
      return true;
    });
  }, [allCombinations, glazeId, positionFilter]);

  // 2. Of those, the ones the user can actually make. Unowned-glaze
  // recommendations belong exclusively on Shop, not this browsing surface.
  const ownedCombos = useMemo(() => {
    return positionCombos.filter(
      (combo) =>
        ownedGlazeIds.has(combo.topGlaze.glazeId) &&
        ownedGlazeIds.has(combo.bottomGlaze.glazeId),
    );
  }, [positionCombos, ownedGlazeIds]);

  // 3. Text search.
  const filteredCombinations = useMemo(() => {
    if (!search) return ownedCombos;
    const searchLower = search.toLowerCase();
    return ownedCombos.filter((combo) => {
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
  }, [ownedCombos, search, glazeId]);

  // Stats
  const stats = useMemo(() => {
    if (!glazeId) return { total: 0, asTop: 0, asBottom: 0 };

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
    };
  }, [allCombinations, glazeId]);

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

          </div>

          {/* Footer: result count. */}
          <div className="mt-3 text-sm text-clay-600 dark:text-clay-400">
            <span className="font-semibold text-clay-800 dark:text-clay-200">
              {filteredCombinations.length}
            </span>{" "}
            of {positionCombos.length} combinations
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredCombinations.length > 0 ? (
        <CombinationGrid combinations={filteredCombinations} />
      ) : positionCombos.length === 0 ? (
        /* This glaze simply has no combinations for the chosen position. */
        <div className="text-center py-12 max-w-md mx-auto">
          <div className="text-5xl mb-4">🎨</div>
          <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-1">
            No combinations yet
          </h2>
          <p className="text-clay-600 dark:text-clay-400">
            {glaze.displayName} doesn&rsquo;t appear{" "}
            {positionFilter === "top"
              ? "as the top glaze in any combination"
              : positionFilter === "bottom"
                ? "as the bottom glaze in any combination"
                : "in any combinations"}{" "}
            yet.
          </p>
        </div>
      ) : ownedCombos.length === 0 ? (
        /* There ARE catalog combinations here, but none use only inventory
           glazes. Keep shopping recommendations on the dedicated Shop page. */
        <div className="text-center py-12 max-w-md mx-auto">
          <div className="text-5xl mb-4">🏺</div>
          <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-1">
            {ownedGlazeIds.size === 0
              ? "You haven't added any glazes yet"
              : "No combinations you can make yet"}
          </h2>
          <p className="text-clay-600 dark:text-clay-400 mb-5">
            {ownedGlazeIds.size === 0 ? (
              <>
                This list only shows combinations you can make with glazes you
                own.
              </>
            ) : (
              <>
                None of these combinations use only glazes you own.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <Link
              to={ownedGlazeIds.size === 0 ? "/glazes" : "/glazes/shop"}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors font-medium"
            >
              {ownedGlazeIds.size === 0
                ? "Mark glazes as owned"
                : "Explore glazes to add"}
            </Link>
          </div>
        </div>
      ) : (
        /* Owned combos exist, but the search text matched none of them. */
        <div className="text-center py-12 max-w-md mx-auto">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-1">
            No matches
          </h2>
          <p className="text-clay-600 dark:text-clay-400 mb-5">
            {search ? (
              <>
                No combinations match{" "}
                <span className="font-medium text-clay-700 dark:text-clay-300">
                  {search}
                </span>
                .
              </>
            ) : (
              "No combinations match your current filters."
            )}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </PageLayout>
  );
}
