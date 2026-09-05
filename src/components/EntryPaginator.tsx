/**
 * Pagination control: prev / "N of M" / next.
 *
 * Used wherever the page shows one entry from a series at a time
 * (CombinationDetailPage entry viewer, GlazeDetailPage Community Results).
 * Renders nothing when there's only one item, so callers can drop it in
 * unconditionally.
 */

import { ChevronLeft, ChevronRight } from "./Icons";

interface EntryPaginatorProps {
  currentIndex: number;
  total: number;
  /** Singular label, e.g. "Entry" or "Result". */
  label: string;
  onPrev: () => void;
  onNext: () => void;
}

export function EntryPaginator({
  currentIndex,
  total,
  label,
  onPrev,
  onNext,
}: EntryPaginatorProps) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mb-3 py-2 px-3 bg-clay-50 dark:bg-earth-700/50 rounded-lg">
      <button
        type="button"
        onClick={onPrev}
        className="p-1.5 rounded-full bg-white dark:bg-earth-600 text-clay-600 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-500 transition-colors shadow-sm"
        aria-label={`Previous ${label.toLowerCase()}`}
      >
        <ChevronLeft />
      </button>
      <span className="text-sm font-medium text-clay-700 dark:text-clay-300">
        {label} {currentIndex + 1} of {total}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="p-1.5 rounded-full bg-white dark:bg-earth-600 text-clay-600 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-500 transition-colors shadow-sm"
        aria-label={`Next ${label.toLowerCase()}`}
      >
        <ChevronRight />
      </button>
    </div>
  );
}
