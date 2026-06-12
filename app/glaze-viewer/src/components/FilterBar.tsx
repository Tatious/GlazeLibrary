/**
 * Filter Bar — combinations grid.
 *
 * Shares its skeleton with `GlazeFilterBar` (full-width search row, then a
 * row of ownership/favorites + content-specific facets, then a footer with
 * result count and a Clear button). The two bars diverge only on earned
 * facets: this one owns Official, Tags, and an expandable Top/Bottom glaze
 * pair; the glazes bar owns Brand and Sort.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CombinationFilters } from "../types/models";
import { useGlazes, useGlazeTags } from "../hooks/useGlazeData";
import { useAuth } from "../hooks/useAuth";
import { TagsDialog } from "./TagsDialog";
import { SearchInput } from "./SearchInput";
import { GlazeCombobox } from "./GlazeCombobox";
import { springs, expandCollapse } from "../config/animations";
import { STORAGE_KEYS } from "../config/storageKeys";
import { Badge, Heart, Tag } from "./Icons";

export type CombinationsOwnershipFilter = "all" | "owned" | "unowned";

const OWNERSHIP_OPTIONS: {
  value: CombinationsOwnershipFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "unowned", label: "Unowned" },
];

interface FilterBarProps {
  filters: CombinationFilters;
  onFiltersChange: (filters: CombinationFilters) => void;
  resultCount: number;
  totalCount: number;
}

export function FilterBar({
  filters,
  onFiltersChange,
  resultCount,
  totalCount,
}: FilterBarProps) {
  const { data: glazes } = useGlazes();
  const tags = useGlazeTags();
  // Favorites are per-user — hide the pill for signed-out visitors.
  const { user } = useAuth();

  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.FILTER_EXPANDED) === "true";
    } catch {
      return false;
    }
  });
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);

  // Sync searchInput when filters.search changes externally (e.g., back navigation)
  useEffect(() => {
    setSearchInput(filters.search || "");
  }, [filters.search]);

  // Persist expanded state
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.FILTER_EXPANDED, String(isExpanded));
    } catch {
      // Ignore storage errors
    }
  }, [isExpanded]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
    // Debounce intentionally keyed on searchInput only; including `filters`/
    // `onFiltersChange` would reset the timer on unrelated filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const ownershipValue: CombinationsOwnershipFilter = filters.ownership ?? "all";
  const handleOwnershipChange = (next: CombinationsOwnershipFilter) => {
    onFiltersChange({
      ...filters,
      ownership: next === "all" ? undefined : next,
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    // Reset to the default surface: owned-only, everything else cleared.
    onFiltersChange({ ownership: "owned" });
  };

  const hasActiveFilters = !!(
    filters.search ||
    filters.topGlazeId ||
    filters.bottomGlazeId ||
    filters.tags?.length ||
    ownershipValue !== "owned" ||
    filters.onlyOfficial ||
    filters.onlyFavorite
  );

  return (
    <div className="bg-clay-100 dark:bg-earth-800 border-b border-clay-300 dark:border-earth-600">
      <div
        className="max-w-7xl mx-auto py-4"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {/* Search — full width on its own row, mirroring GlazeFilterBar. */}
        <div className="mb-3">
          <SearchInput
            placeholder="Search glazes, colors, effects..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-clay-50 dark:bg-earth-700"
          />
        </div>

        {/* Filter row: ownership/favorites on the left, content facets on the right. */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Ownership filter — segmented button group. */}
          <div className="inline-flex rounded-lg border border-clay-300 dark:border-earth-500 overflow-hidden">
            {OWNERSHIP_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleOwnershipChange(value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  ownershipValue === value
                    ? "bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200"
                    : "bg-clay-50 text-clay-700 dark:bg-earth-700 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Favorites toggle — only meaningful for signed-in users. */}
          {user && (
            <button
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  onlyFavorite: !filters.onlyFavorite,
                })
              }
              className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 border ${
                filters.onlyFavorite
                  ? "bg-terracotta-100 text-terracotta-700 border-terracotta-400 dark:bg-terracotta-900 dark:text-terracotta-300 dark:border-terracotta-600"
                  : "bg-clay-50 text-clay-600 border-clay-300 dark:bg-earth-700 dark:text-clay-400 dark:border-earth-500 hover:bg-clay-100 hover:border-clay-400 dark:hover:bg-earth-600"
              }`}
            >
              <Heart filled={filters.onlyFavorite} />
              Favorites
            </button>
          )}

          {/* Divider — hidden on mobile so the row can wrap cleanly
              without leaving a stray vertical line between sub-rows. */}
          <div className="hidden sm:block h-5 w-px bg-clay-300 dark:bg-earth-600" />

          {/* Official toggle */}
          <button
            onClick={() =>
              onFiltersChange({
                ...filters,
                onlyOfficial: !filters.onlyOfficial,
              })
            }
            className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 border ${
              filters.onlyOfficial
                ? "bg-sage-100 text-sage-700 border-sage-400 dark:bg-sage-900 dark:text-sage-300 dark:border-sage-500"
                : "bg-clay-50 text-clay-600 border-clay-300 dark:bg-earth-700 dark:text-clay-400 dark:border-earth-500 hover:bg-clay-100 hover:border-clay-400 dark:hover:bg-earth-600"
            }`}
          >
            <Badge />
            Official
          </button>

          {/* Tags */}
          <button
            onClick={() => setIsTagsDialogOpen(true)}
            className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 border ${
              filters.tags?.length
                ? "bg-sage-100 text-sage-700 border-sage-400 dark:bg-sage-900 dark:text-sage-300 dark:border-sage-500"
                : "bg-clay-50 text-clay-600 border-clay-300 dark:bg-earth-700 dark:text-clay-400 dark:border-earth-500 hover:bg-clay-100 hover:border-clay-400 dark:hover:bg-earth-600"
            }`}
          >
            <Tag />
            Tags{filters.tags?.length ? ` (${filters.tags.length})` : ""}
          </button>
        </div>

        {/* Expanded: top/bottom glaze selects — combos-only facet, hidden by default.
            `initial={false}` keeps the section in its final state on mount so
            navigating back with the section already expanded doesn't replay
            the open animation; only user toggles animate. */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={expandCollapse}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-clay-300 dark:border-earth-600 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                <GlazeCombobox
                  glazes={glazes}
                  label="Top Glaze"
                  placeholder="Any"
                  fullWidth
                  clearable
                  value={filters.topGlazeId ?? null}
                  onChange={(next) =>
                    onFiltersChange({
                      ...filters,
                      topGlazeId:
                        typeof next === "string" && next ? next : undefined,
                    })
                  }
                />
                <GlazeCombobox
                  glazes={glazes}
                  label="Bottom Glaze"
                  placeholder="Any"
                  fullWidth
                  clearable
                  value={filters.bottomGlazeId ?? null}
                  onChange={(next) =>
                    onFiltersChange({
                      ...filters,
                      bottomGlazeId:
                        typeof next === "string" && next ? next : undefined,
                    })
                  }
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer: result count, Clear, expand chevron. */}
        <div className="mt-3 flex items-center justify-between text-sm gap-2">
          <span className="text-clay-600 dark:text-clay-400">
            <span className="font-semibold text-clay-800 dark:text-clay-200">
              {resultCount}
            </span>{" "}
            of {totalCount} combinations
          </span>

          <div className="flex items-center gap-2">
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={springs.quick}
                  onClick={clearFilters}
                  className="px-2 py-1 text-terracotta-600 dark:text-terracotta-400 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/30 rounded font-medium whitespace-nowrap transition-colors focus-ring"
                >
                  Clear
                </motion.button>
              )}
            </AnimatePresence>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-clay-500 dark:text-clay-400 hover:text-clay-700 dark:hover:text-clay-200 border border-clay-300 dark:border-earth-600 rounded transition-colors focus-ring"
              title={isExpanded ? "Hide glaze filters" : "Show glaze filters"}
            >
              <motion.svg
                className="w-4 h-4"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={springs.snappy}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </motion.svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tags Dialog */}
      <TagsDialog
        isOpen={isTagsDialogOpen}
        onClose={() => setIsTagsDialogOpen(false)}
        availableTags={tags}
        selectedTags={filters.tags ?? []}
        onTagsChange={(newTags) =>
          onFiltersChange({
            ...filters,
            tags: newTags.length > 0 ? newTags : undefined,
          })
        }
      />
    </div>
  );
}
