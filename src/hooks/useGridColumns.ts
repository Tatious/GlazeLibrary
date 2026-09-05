/**
 * `useGridColumns` — column-count hook for virtualized card grids.
 *
 * Mirrors the Tailwind breakpoint tiers defined in `tailwind.config.js`
 * (xsl / xs / sm / md / lg / xl / 2xl). Keeps virtualized grids visually
 * in lockstep with non-virtualized Tailwind grids that use the same
 * `cols` map.
 *
 * The `cols` map is keyed by tier; only the tiers the caller cares about
 * need to be set. Missing tiers fall back to the next-smaller defined
 * tier (matching how mobile-first Tailwind responsive classes resolve).
 *
 * `xsl` (max-height: 480px) is checked first so a phone in landscape
 * (e.g. iPhone Pro Max 932×430) gets its dedicated column count rather
 * than falling through to the width-based tiers.
 */

import { useEffect, useState } from "react";

export type Tier = "base" | "xsl" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export type ColumnMap = Partial<Record<Tier, number>> & { base: number };

// Min-width thresholds for the width tiers. `base` is the unconditional
// default; `xsl` is selected by height (not width). Mirrors
// `tailwind.config.js` screens.
const WIDTH_THRESHOLDS: Array<[Exclude<Tier, "base" | "xsl">, number]> = [
  ["2xl", 1536],
  ["xl", 1280],
  ["lg", 1024],
  ["md", 768],
  ["sm", 640],
  ["xs", 480],
];

function resolve(cols: ColumnMap, tier: Tier): number {
  // Walk tier → smaller tiers → base, returning the first defined value.
  if (tier === "base") return cols.base;
  const order: Tier[] = ["2xl", "xl", "lg", "md", "sm", "xs", "xsl", "base"];
  const start = order.indexOf(tier);
  for (let i = start; i < order.length; i++) {
    const v = cols[order[i]];
    if (v !== undefined) return v;
  }
  return cols.base;
}

function compute(cols: ColumnMap): number {
  if (typeof window === "undefined") return cols.base;
  // xsl beats every width tier — a short viewport (landscape phone) is
  // its own bucket regardless of width.
  if (window.innerHeight <= 480 && cols.xsl !== undefined) return cols.xsl;
  const width = window.innerWidth;
  for (const [tier, min] of WIDTH_THRESHOLDS) {
    if (width >= min) return resolve(cols, tier);
  }
  return cols.base;
}

export function useGridColumns(cols: ColumnMap): number {
  const [count, setCount] = useState(() => compute(cols));
  useEffect(() => {
    const onResize = () => setCount(compute(cols));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // The cols map is stable in practice (defined as a module constant
    // by callers). We avoid wiring deep equality here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return count;
}
