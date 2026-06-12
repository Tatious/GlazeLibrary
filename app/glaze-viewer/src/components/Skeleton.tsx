/**
 * Loading skeleton primitives.
 *
 * `<Skeleton>` — single shimmering bar; pass `className` to size it.
 * `<SkeletonGrid>` — N square placeholders in M columns, for image grids.
 * `<SkeletonHeader>` — the standard "title bar + subtitle bar" pair used
 * above grids.
 *
 * Replaces the two near-identical `animate-pulse` blocks in
 * GlazeCombinationsPage and ExplorePage. Animation lives inside `<Skeleton>`
 * so the ESLint ban on `animate-pulse` outside components/ stays effective.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-clay-200 dark:bg-earth-700 rounded ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

interface SkeletonHeaderProps {
  className?: string;
}

export function SkeletonHeader({ className = "" }: SkeletonHeaderProps) {
  return (
    <div className={`animate-pulse space-y-4 ${className}`.trim()}>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

type GridCols = 1 | 2 | 3 | 4;

interface SkeletonGridProps {
  /** Number of placeholder tiles. */
  count: number;
  /** Responsive column shape. `image` = aspect-square; `card` = h-48. */
  shape?: "image" | "card";
  /** Max columns at lg+ breakpoint. */
  cols?: GridCols;
  className?: string;
}

const COLS_CLASS: Record<GridCols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

export function SkeletonGrid({
  count,
  shape = "image",
  cols = 4,
  className = "",
}: SkeletonGridProps) {
  const tileShape = shape === "image" ? "aspect-square" : "h-48";
  return (
    <div className={`grid gap-4 ${COLS_CLASS[cols]} ${className}`.trim()}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`${tileShape} rounded-lg`} />
      ))}
    </div>
  );
}
