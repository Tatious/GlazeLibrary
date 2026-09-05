/**
 * Shared identifier helpers for combination entries.
 *
 * The "combination ID" groups multiple entries (community + scraped) that share
 * the same top/bottom glaze pair. Normalized form matches the scraped data:
 *   "amaco-c-01-over-c-47"            (brand-topCode-over-bottomCode)
 * NOT the verbose
 *   "amaco-c-01-over-amaco-c-47"      (topId-over-bottomId)
 */

import { randomUUID } from "crypto";

/**
 * Derive a combinationId from the top/bottom glaze IDs.
 * Single-glaze uploads (no bottom) group all results under the topGlazeId.
 */
export function makeCombinationId(topGlazeId, bottomGlazeId) {
  if (topGlazeId && bottomGlazeId) {
    const brandMatch = topGlazeId.match(/^(\w+)-/);
    const brand = brandMatch ? brandMatch[1] : null;
    if (brand && bottomGlazeId.startsWith(`${brand}-`)) {
      const bottomCode = bottomGlazeId.slice(brand.length + 1);
      return `${topGlazeId}-over-${bottomCode}`;
    }
    return `${topGlazeId}-over-${bottomGlazeId}`;
  }
  if (topGlazeId) return topGlazeId;
  return `user-${randomUUID()}`;
}
