/**
 * Mirror of server/lib/combinationId.js — keep the two in sync.
 *
 * Lets the client derive the same `combinationId` the server stores under
 * `Piece.publishedEntries[].comboId`, so a glaze-plan row can look up
 * whether it already has a published result.
 */

export function makeCombinationId(
  topGlazeId: string,
  bottomGlazeId: string | null | undefined,
): string {
  if (topGlazeId && bottomGlazeId) {
    const brandMatch = topGlazeId.match(/^(\w+)-/);
    const brand = brandMatch ? brandMatch[1] : null;
    if (brand && bottomGlazeId.startsWith(`${brand}-`)) {
      const bottomCode = bottomGlazeId.slice(brand.length + 1);
      return `${topGlazeId}-over-${bottomCode}`;
    }
    return `${topGlazeId}-over-${bottomGlazeId}`;
  }
  return topGlazeId;
}
