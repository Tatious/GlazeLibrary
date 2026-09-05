/**
 * Explore Page
 * Helps users discover which glazes would be most valuable to add to their collection
 * by showing how many new combinations each unowned glaze would unlock
 */

import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGlazes, useCombinations, useMyGlazes } from "../hooks/useGlazeData";
import { useHistorySearch } from "../hooks/useHistorySearch";
import { SearchInput } from "../components/SearchInput";
import { PageLayout } from "../components/PageLayout";
import { SkeletonHeader, SkeletonGrid } from "../components/Skeleton";
import { ChevronDown } from "../components/Icons";
import type { Glaze, GlazeCombination } from "../types/models";
import { getPrimaryImage, prefixCdnUrl } from "../utils/glazeUtils";
import { springs, expandCollapse } from "../config/animations";
import { STORAGE_KEYS } from "../config/storageKeys";

// Get/save expanded glaze from sessionStorage
function getSavedExpandedGlaze(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.EXPLORE_EXPANDED_GLAZE);
  } catch {
    return null;
  }
}

function saveExpandedGlaze(glazeId: string | null): void {
  try {
    if (glazeId) {
      sessionStorage.setItem(STORAGE_KEYS.EXPLORE_EXPANDED_GLAZE, glazeId);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.EXPLORE_EXPANDED_GLAZE);
    }
  } catch {
    // Ignore storage errors
  }
}

type SortOption = "combinations" | "name" | "code";

interface GlazeWithPotential {
  glaze: Glaze;
  potentialCombinations: GlazeCombination[];
  newCombinationsCount: number;
}

export function ExplorePage() {
  const navigate = useNavigate();
  const { data: glazes = [], isLoading: glazesLoading } = useGlazes();
  const { data: combinations = [], isLoading: combosLoading } =
    useCombinations();
  const myGlazes = useMyGlazes();

  const isLoading = glazesLoading || combosLoading;

  const [search, setSearch] = useHistorySearch();
  const [brandFilter, setBrandFilter] = useState<
    "all" | "amaco" | "mayco" | "sps"
  >("all");
  const [sortBy, setSortBy] = useState<SortOption>("combinations");
  const [sortAsc, setSortAsc] = useState(false); // Default descending for combinations
  const [expandedGlaze, setExpandedGlaze] = useState<string | null>(() =>
    getSavedExpandedGlaze(),
  );

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(option);
      // Default to descending for combinations, ascending for name/code
      setSortAsc(option !== "combinations");
    }
  };

  // Persist expanded state
  useEffect(() => {
    saveExpandedGlaze(expandedGlaze);
  }, [expandedGlaze]);

  // Get set of owned glaze IDs for quick lookup
  const ownedGlazeIds = useMemo(() => {
    return new Set(
      Object.entries(myGlazes.glazes)
        .filter(([, entry]) => entry.owned)
        .map(([id]) => id),
    );
  }, [myGlazes.glazes]);

  // Calculate potential combinations for each unowned glaze
  const glazesWithPotential = useMemo(() => {
    if (!glazes.length || !combinations.length) return [];

    const results: GlazeWithPotential[] = [];

    for (const glaze of glazes) {
      // Skip if user already owns this glaze
      if (ownedGlazeIds.has(glaze.id)) continue;

      // Find combinations where:
      // - This glaze is the top glaze AND user owns the bottom glaze
      // - OR this glaze is the bottom glaze AND user owns the top glaze
      const potentialCombos = combinations.filter((combo) => {
        const isTop = combo.topGlaze.glazeId === glaze.id;
        const isBottom = combo.bottomGlaze.glazeId === glaze.id;

        if (isTop && ownedGlazeIds.has(combo.bottomGlaze.glazeId)) {
          return true;
        }
        if (isBottom && ownedGlazeIds.has(combo.topGlaze.glazeId)) {
          return true;
        }
        return false;
      });

      // Only include glazes that would unlock at least 1 combination
      if (potentialCombos.length > 0) {
        results.push({
          glaze,
          potentialCombinations: potentialCombos,
          newCombinationsCount: potentialCombos.length,
        });
      }
    }

    return results;
  }, [glazes, combinations, ownedGlazeIds]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let filtered = glazesWithPotential;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        ({ glaze }) =>
          glaze.displayName.toLowerCase().includes(searchLower) ||
          glaze.code.toLowerCase().includes(searchLower) ||
          glaze.name.toLowerCase().includes(searchLower),
      );
    }

    // Brand filter
    if (brandFilter !== "all") {
      filtered = filtered.filter(({ glaze }) => {
        const brand = glaze.brand?.toLowerCase() || "";
        if (brandFilter === "sps") return brand.includes("seattle");
        return brand === brandFilter;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "combinations":
          cmp = a.newCombinationsCount - b.newCombinationsCount;
          break;
        case "name":
          cmp = a.glaze.displayName.localeCompare(b.glaze.displayName);
          break;
        case "code":
          cmp = a.glaze.code.localeCompare(b.glaze.code);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [glazesWithPotential, search, brandFilter, sortBy, sortAsc]);

  // Stats
  const totalPotentialCombos = useMemo(() => {
    return glazesWithPotential.reduce(
      (sum, g) => sum + g.newCombinationsCount,
      0,
    );
  }, [glazesWithPotential]);

  if (isLoading) {
    return (
      <PageLayout maxWidth="7xl" padY="8">
        <SkeletonHeader />
        <SkeletonGrid count={6} shape="card" cols={3} className="mt-8" />
      </PageLayout>
    );
  }

  if (ownedGlazeIds.size === 0) {
    return (
      <PageLayout maxWidth="7xl" padY="8">
        <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-6">
          Shop
        </h1>
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🎨</div>
          <h2 className="text-xl font-bold text-clay-800 dark:text-clay-200 mb-2">
            Start Your Collection
          </h2>
          <p className="text-clay-600 dark:text-clay-400 mb-6 max-w-md mx-auto">
            Mark some glazes as owned in the{" "}
            <Link to="/glazes" className="text-terracotta-600 hover:underline">
              Glazes
            </Link>{" "}
            tab first, then come back here to see which glazes would expand your
            combination possibilities the most!
          </p>
          <Link
            to="/glazes"
            className="inline-flex items-center gap-2 px-6 py-3 bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors"
          >
            Go to Glazes →
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="7xl" padY="8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-2">
          Shop
        </h1>
        <p className="text-clay-600 dark:text-clay-400">
          See which glazes would unlock the most new combinations based on
          what you already own.
        </p>
      </div>

      {/* Stats Banner */}
      <div className="bg-gradient-to-r from-moss-100 to-sage-100 dark:from-moss-900/50 dark:to-sage-900/50 rounded-lg p-4 mb-6 border border-moss-200 dark:border-moss-800">
        <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-moss-700 dark:text-moss-300">
              {ownedGlazeIds.size}
            </div>
            <div className="text-sm text-moss-600 dark:text-moss-400">
              Glazes Owned
            </div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-sage-700 dark:text-sage-300">
              {filteredAndSorted.length}
            </div>
            <div className="text-sm text-sage-600 dark:text-sage-400">
              Glazes to Explore
            </div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-terracotta-700 dark:text-terracotta-300">
              {totalPotentialCombos}
            </div>
            <div className="text-sm text-terracotta-600 dark:text-terracotta-400">
              Potential New Combos
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Search */}
        <SearchInput
          placeholder="Search glazes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Brand filter and Sort */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Brand Filter - segmented button group */}
          <div className="inline-flex rounded-lg border border-clay-300 dark:border-earth-500 overflow-hidden">
            {(["all", "amaco", "mayco", "sps"] as const).map((brand) => (
              <button
                key={brand}
                onClick={() => setBrandFilter(brand)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  brandFilter === brand
                    ? "bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200"
                    : "bg-clay-50 text-clay-700 dark:bg-earth-700 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-600"
                }`}
              >
                {brand === "all" ? "All" : brand.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-x-3">
            <span className="text-sm text-clay-500 dark:text-earth-400">
              Sort:
            </span>
            {(
              [
                { key: "combinations", label: "Combos" },
                { key: "name", label: "Name" },
                { key: "code", label: "Code" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className={`text-sm font-medium transition-colors px-1.5 py-0.5 rounded ${
                  sortBy === key
                    ? "text-terracotta-600 dark:text-terracotta-400"
                    : "text-clay-600 dark:text-clay-400 hover:text-clay-800 hover:bg-clay-100 active:bg-clay-200 dark:hover:text-clay-300 dark:hover:bg-earth-700 dark:active:bg-earth-600"
                }`}
              >
                {label}
                {sortBy === key && (
                  <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredAndSorted.length === 0 ? (
        <div className="text-center py-12 text-clay-500 dark:text-clay-400">
          No glazes found matching your criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSorted.map(
            ({ glaze, potentialCombinations, newCombinationsCount }) => {
              const thumbnail = getPrimaryImage(glaze);
              const isExpanded = expandedGlaze === glaze.id;

              return (
                <motion.div
                  key={glaze.id}
                  initial="rest"
                  whileHover="hover"
                  variants={{
                    rest: { scale: 1 },
                    hover: { scale: 1.005 },
                  }}
                  transition={springs.quick}
                  className="bg-white dark:bg-earth-800 rounded-lg border-2 border-sage-100 dark:border-earth-600 hover:border-sage-300 dark:hover:border-sage-700 overflow-hidden focus-ring-within transition-colors"
                >
                  {/* Main Row - clickable to glaze detail */}
                  <div
                    onClick={() => navigate(`/glaze/${glaze.id}`)}
                    className="flex hover:bg-clay-50 dark:hover:bg-earth-700/50 transition-colors cursor-pointer"
                  >
                    {/* Thumbnail - square aspect ratio, fixed width */}
                    <div className="shrink-0 w-20 sm:w-24 aspect-square">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={glaze.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-clay-200 dark:bg-earth-700 flex items-center justify-center">
                          <span className="text-clay-400 text-xl sm:text-2xl">
                            🎨
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 p-3 sm:p-4">
                      <div className="font-semibold text-sm sm:text-base text-clay-800 dark:text-clay-200 truncate">
                        {glaze.displayName}
                      </div>
                      {/* Brand only on mobile, Brand · Series on sm+ */}
                      <div className="text-xs sm:text-sm text-clay-500 dark:text-clay-400">
                        <span className="sm:hidden">{glaze.brand}</span>
                        <span className="hidden sm:inline">
                          {glaze.brand} · {glaze.series}
                        </span>
                      </div>
                      {/* Show combo count inline on mobile */}
                      <div className="text-xs text-moss-600 dark:text-moss-400 mt-0.5 sm:hidden">
                        {newCombinationsCount} combo
                        {newCombinationsCount !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Actions - stop propagation to prevent navigation */}
                    <div
                      className="flex items-center shrink-0 pr-2 sm:pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Desktop: separate "See X combos" button and expand chevron */}
                      <button
                        onClick={() =>
                          navigate(`/glaze/${glaze.id}/combinations`)
                        }
                        className="hidden sm:block px-3 py-1.5 text-sm font-medium rounded-lg bg-terracotta-100 text-terracotta-700 hover:bg-terracotta-200 dark:bg-terracotta-900/50 dark:text-terracotta-300 dark:hover:bg-terracotta-800/50 transition-colors mr-2"
                      >
                        See {newCombinationsCount} combo
                        {newCombinationsCount !== 1 ? "s" : ""}
                      </button>
                      {/* Mobile: combined count + expand button */}
                      <button
                        onClick={() => {
                          setExpandedGlaze(isExpanded ? null : glaze.id);
                        }}
                        className="sm:hidden flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-clay-100 text-clay-700 hover:bg-clay-200 dark:bg-earth-700 dark:text-clay-300 dark:hover:bg-earth-600 transition-colors"
                      >
                        <span>{newCombinationsCount}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                      {/* Desktop expand button */}
                      <button
                        onClick={() => {
                          setExpandedGlaze(isExpanded ? null : glaze.id);
                        }}
                        className="hidden sm:block p-2 text-clay-500 hover:text-clay-700 dark:text-clay-400 dark:hover:text-clay-200 transition-colors"
                        title={isExpanded ? "Hide preview" : "Show preview"}
                      >
                        <ChevronDown
                          className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Combinations Preview */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        variants={expandCollapse}
                        transition={springs.snappy}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-clay-300 dark:border-earth-700 bg-clay-100 dark:bg-earth-900/50 p-4">
                          <div className="text-sm font-medium text-clay-700 dark:text-clay-400 mb-3">
                            Sample combinations with your glazes:
                          </div>
                          {/* 2 rows: 2 cols on mobile (3 items + see all), 3 cols on sm (5 + see all), etc */}
                          <div className="grid grid-cols-2 xsl:grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                            {/* Show 3 items on mobile (2 cols × 2 rows - 1 for see all), 5 on sm, 7 on md, 9 on lg */}
                            {potentialCombinations
                              .slice(0, 9) // Max items for lg (5 cols × 2 rows - 1)
                              .map((combo, index) => {
                                // Hide items that don't fit in 2 rows at each breakpoint
                                // Mobile: show 3, sm: show 5, md: show 7, lg: show 9
                                const hideClasses =
                                  index >= 3
                                    ? index >= 5
                                      ? index >= 7
                                        ? "hidden lg:block"
                                        : "hidden md:block"
                                      : "hidden sm:block"
                                    : "";

                                const coverPhoto =
                                  combo.entries?.[0]?.photos?.find(
                                    (p) => p.isCover,
                                  ) || combo.entries?.[0]?.photos?.[0];
                                const otherGlaze =
                                  combo.topGlaze.glazeId === glaze.id
                                    ? combo.bottomGlaze
                                    : combo.topGlaze;
                                const position =
                                  combo.topGlaze.glazeId === glaze.id
                                    ? "over"
                                    : "under";

                                return (
                                  <Link
                                    key={combo.id}
                                    to={`/combination/${combo.id}`}
                                    className={`group block ${hideClasses}`}
                                  >
                                    <div className="aspect-square rounded-lg overflow-hidden bg-clay-200 dark:bg-earth-700">
                                      {coverPhoto ? (
                                        <img
                                          src={prefixCdnUrl(coverPhoto.url)}
                                          alt={`${glaze.displayName} ${position} ${otherGlaze.displayName}`}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-clay-400">
                                          🎨
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-clay-600 dark:text-clay-400 truncate mt-1 leading-tight">
                                      {position} {otherGlaze.displayName}
                                    </div>
                                  </Link>
                                );
                              })}
                            {/* See All card - always last in the grid */}
                            <Link
                              to={`/glaze/${glaze.id}/combinations`}
                              className="group block"
                            >
                              <div className="aspect-square rounded-lg overflow-hidden bg-terracotta-100 dark:bg-terracotta-900/30 flex items-center justify-center group-hover:bg-terracotta-200 dark:group-hover:bg-terracotta-900/50 transition-colors">
                                <div className="text-center">
                                  <div className="text-xl sm:text-2xl font-bold text-terracotta-600 dark:text-terracotta-400">
                                    {newCombinationsCount}
                                  </div>
                                  <div className="text-[10px] sm:text-xs text-terracotta-500 dark:text-terracotta-400">
                                    total
                                  </div>
                                </div>
                              </div>
                              <div className="text-[10px] sm:text-xs text-terracotta-600 dark:text-terracotta-400 text-center font-medium mt-1 leading-tight">
                                See all →
                              </div>
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            },
          )}
        </div>
      )}
    </PageLayout>
  );
}
