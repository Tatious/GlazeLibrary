/**
 * Combination Grid Component
 * Displays a virtualized grid of glaze combinations
 *
 * Scroll restoration is handled by ScrollManager at the app root.
 */

import React from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { GlazeCombination } from "../types/models";
import { CombinationCard } from "./CombinationCard";
import type { SelectionStore } from "../hooks/useBatchSelect";
import { useGridColumns, type ColumnMap } from "../hooks/useGridColumns";

interface CombinationGridProps {
  combinations: GlazeCombination[];
  /** Pass-through selection props (see CombinationCard for behavior). */
  selectionMode?: boolean;
  /** Selection store — cards subscribe per-key, parent doesn't re-render
   *  on toggle. Required when `selectionMode` is true. */
  selectionStore?: SelectionStore;
}

const GAP = 16;

// Matches the Tailwind classes used by `CombinationGridSimple`:
// grid-cols-2 xsl:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
const COLS: ColumnMap = { base: 2, xsl: 4, md: 3, lg: 4, xl: 5 };

export function CombinationGrid({
  combinations,
  selectionMode,
  selectionStore,
}: CombinationGridProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = React.useState(300); // Initial estimate
  const observerRef = React.useRef<ResizeObserver | null>(null);

  const columnCount = useGridColumns(COLS);

  // Callback ref for measurement row
  const measureRowRef = React.useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (height > 0) {
          setRowHeight((prev) => {
            // Only update if significantly different (avoid floating point noise)
            if (Math.abs(prev - height) > 0.5) {
              return height;
            }
            return prev;
          });
        }
      }
    });

    observer.observe(node);
    observerRef.current = observer;

    // Initial measurement
    const rect = node.getBoundingClientRect();
    if (rect.height > 0) {
      setRowHeight((prev) => {
        if (Math.abs(prev - rect.height) > 0.5) {
          return rect.height;
        }
        return prev;
      });
    }
  }, []); // No dependencies - only set up once per mount

  const rows = Math.ceil(combinations.length / columnCount);

  // Track previous rowHeight to avoid infinite loops
  const prevRowHeightRef = React.useRef(rowHeight);

  // Create virtualizer with gap
  const rowVirtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: React.useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
    gap: GAP,
  });

  // Force virtualizer to re-measure when rowHeight changes (but only once per change)
  React.useEffect(() => {
    if (prevRowHeightRef.current !== rowHeight) {
      prevRowHeightRef.current = rowHeight;
      rowVirtualizer.measure();
    }
  }, [rowHeight, rowVirtualizer]);

  if (combinations.length === 0) {
    return null;
  }

  // First row combos for measurement
  const firstRowCombos = combinations.slice(0, columnCount);

  return (
    <>
      {/* Hidden measurement row - measures card height only, virtualizer handles gap */}
      <div
        ref={measureRowRef}
        className="grid gap-4"
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
          width: listRef.current?.offsetWidth || "100%",
        }}
        aria-hidden="true"
      >
        {firstRowCombos.map((combination) => (
          <CombinationCard
            key={`measure-${combination.id}`}
            combination={combination}
            selectionMode={selectionMode}
            selectionStore={selectionStore}
          />
        ))}
      </div>

      {/* Main virtualized grid */}
      <div
        ref={listRef}
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const endIndex = Math.min(
            startIndex + columnCount,
            combinations.length,
          );
          const rowCombinations = combinations.slice(startIndex, endIndex);

          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              className="grid gap-4"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
              }}
            >
              {rowCombinations.map((combination) => (
                <CombinationCard
                  key={combination.id}
                  combination={combination}
                  selectionMode={selectionMode}
                  selectionStore={selectionStore}
                />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

// Non-virtualized version for smaller lists
export function CombinationGridSimple({
  combinations,
  selectionMode,
  selectionStore,
}: CombinationGridProps) {
  return (
    <div className="grid grid-cols-2 xsl:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {combinations.map((combination) => (
        <CombinationCard
          key={combination.id}
          combination={combination}
          selectionMode={selectionMode}
          selectionStore={selectionStore}
        />
      ))}
    </div>
  );
}
