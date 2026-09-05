/**
 * Canonical key shape for "glaze or combination" references used across the
 * batch-select grids, the swipe-deck rejected set, and dedupe checks.
 *
 * The colon separator is chosen over `-` because glaze IDs themselves contain
 * `-` (e.g. `amaco-pc-30-temmoku`), which forced earlier code to split on
 * `indexOf('-')` and made the parse fragile if a type ever picked up a `-`
 * in its name.
 *
 * `parseItemKey` is intentionally permissive of the legacy `${type}-${id}`
 * form so stored progress from older sessions still matches after the
 * switchover.
 */

export type ItemType = "glaze" | "combination";

export interface ItemRef {
  type: ItemType;
  id: string;
}

const SEP = ":";

export function itemKey(ref: ItemRef): string {
  return `${ref.type}${SEP}${ref.id}`;
}

export function parseItemKey(key: string): ItemRef | null {
  const colon = key.indexOf(SEP);
  if (colon > 0) {
    const type = key.slice(0, colon);
    if (type === "glaze" || type === "combination") {
      return { type, id: key.slice(colon + 1) };
    }
  }
  // Legacy `${type}-${id}` form. Glaze and combination IDs may contain `-`
  // themselves, so we only split on the first one and trust that the prefix
  // is always one of our two known type tokens.
  const dash = key.indexOf("-");
  if (dash > 0) {
    const type = key.slice(0, dash);
    if (type === "glaze" || type === "combination") {
      return { type, id: key.slice(dash + 1) };
    }
  }
  return null;
}

/** Normalize a possibly-legacy set of keys to the canonical colon form. */
export function normalizeKeys(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const k of keys) {
    const ref = parseItemKey(k);
    if (ref) out.add(itemKey(ref));
  }
  return out;
}
