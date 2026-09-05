/**
 * Sticky filter bar on the Glazes page.
 *
 * Full-width header (so its background bleeds edge-to-edge) with a constrained
 * inner block — that's why it can't use `<PageLayout>` and has its own
 * safe-area insets. (One of the few places in the codebase that legitimately
 * needs the inline style; the inline-style ESLint rule is disabled per line.)
 *
 * Pure controlled UI: search / ownership / favorites / brand / sort / sort
 * direction all come from the page (via `useFilterStorage`). The only logic
 * the bar owns is the toggle-asc-on-resort UX (`handleSort`).
 */

import { SearchInput } from "../SearchInput";
import { useAuth } from "../../hooks/useAuth";
import { Heart } from "../Icons";

export type GlazesSortOption = "name" | "code" | "combinations";
export type GlazesOwnershipFilter = "all" | "owned" | "unowned";
export type GlazesBrandFilter = "all" | "amaco" | "mayco" | "sps";

interface GlazeFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  ownershipFilter: GlazesOwnershipFilter;
  onOwnershipFilterChange: (value: GlazesOwnershipFilter) => void;
  showFavoritesOnly: boolean;
  onShowFavoritesOnlyChange: (value: boolean) => void;
  brandFilter: GlazesBrandFilter;
  onBrandFilterChange: (value: GlazesBrandFilter) => void;
  sortBy: GlazesSortOption;
  onSortByChange: (value: GlazesSortOption) => void;
  sortAsc: boolean;
  onSortAscChange: (value: boolean) => void;
  resultCount: number;
  totalCount: number;
}

const OWNERSHIP_OPTIONS: { value: GlazesOwnershipFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "unowned", label: "Unowned" },
];

const BRAND_OPTIONS: { value: GlazesBrandFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "amaco", label: "AMACO" },
  { value: "mayco", label: "MAYCO" },
  { value: "sps", label: "SPS" },
];

const SORT_OPTIONS: { key: GlazesSortOption; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "code", label: "Code" },
  { key: "combinations", label: "Combos" },
];

export function GlazeFilterBar({
  search,
  onSearchChange,
  ownershipFilter,
  onOwnershipFilterChange,
  showFavoritesOnly,
  onShowFavoritesOnlyChange,
  brandFilter,
  onBrandFilterChange,
  sortBy,
  onSortByChange,
  sortAsc,
  onSortAscChange,
  resultCount,
  totalCount,
}: GlazeFilterBarProps) {
  // Favorites are per-user \u2014 hide the filter pill for signed-out visitors.
  const { user } = useAuth();
  const handleSort = (option: GlazesSortOption) => {
    if (sortBy === option) {
      onSortAscChange(!sortAsc);
    } else {
      onSortByChange(option);
      onSortAscChange(true);
    }
  };

  return (
    <div className="bg-clay-100 dark:bg-earth-800 border-b border-clay-300 dark:border-earth-600">
      <div
        className="max-w-7xl mx-auto py-4"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {/* Search - always full width on its own row */}
        <div className="mb-3">
          <SearchInput
            placeholder="Search glazes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-clay-50 dark:bg-earth-700"
          />
        </div>

        {/* Filter and brand buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Ownership filter - segmented button group */}
          <div className="inline-flex rounded-lg border border-clay-300 dark:border-earth-500 overflow-hidden">
            {OWNERSHIP_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onOwnershipFilterChange(value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  ownershipFilter === value
                    ? "bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200"
                    : "bg-clay-50 text-clay-700 dark:bg-earth-700 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Favorites toggle \u2014 only meaningful for signed-in users. */}
          {user && (
          <button
            onClick={() => onShowFavoritesOnlyChange(!showFavoritesOnly)}
            className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 border ${
              showFavoritesOnly
                ? "bg-terracotta-100 text-terracotta-700 border-terracotta-400 dark:bg-terracotta-900 dark:text-terracotta-300 dark:border-terracotta-600"
                : "bg-clay-50 text-clay-600 border-clay-300 dark:bg-earth-700 dark:text-clay-400 dark:border-earth-500 hover:bg-clay-100 hover:border-clay-400 dark:hover:bg-earth-600"
            }`}
          >
            <Heart filled={showFavoritesOnly} />
            Favorites
          </button>
          )}

          {/* Divider — hidden on mobile so the row can wrap cleanly
              without leaving a stray vertical line between sub-rows. */}
          <div className="hidden sm:block h-5 w-px bg-clay-300 dark:bg-earth-600" />

          {/* Brand filter - segmented button group */}
          <div className="inline-flex rounded-lg border border-clay-300 dark:border-earth-500 overflow-hidden">
            {BRAND_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onBrandFilterChange(value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  brandFilter === value
                    ? "bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200"
                    : "bg-clay-50 text-clay-700 dark:bg-earth-700 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort options and result count */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm text-clay-500 dark:text-earth-400">
              Sort:
            </span>
            {SORT_OPTIONS.map(({ key, label }) => (
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
          <div className="text-sm text-clay-600 dark:text-clay-400 text-right">
            <span className="font-semibold text-clay-800 dark:text-clay-200">
              {resultCount}
            </span>{" "}
            of {totalCount} glazes
          </div>
        </div>
      </div>
    </div>
  );
}
