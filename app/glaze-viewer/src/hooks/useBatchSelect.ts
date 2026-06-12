/**
 * useBatchSelect — selection-mode state for the grid pages (Glazes,
 * Combinations).
 *
 * Two ways to enter selection mode:
 *   1. User clicks the "Select" button → `enable()`.
 *   2. URL carries an `?addTo=piece:{id}` or `?addTo=collection:{id}` param
 *      (the "reverse entry" flow from a piece's "Add more" row). In that
 *      case selection mode auto-enables AND the target is pre-pinned so
 *      the bar shows just one "Add to {name}" button.
 *
 * The selection set is kept in a ref-stable external store so that
 * toggling a card doesn't re-render the page or the other ~600 cards in
 * the grid. Cards subscribe to their own key via `useIsSelected(store,
 * key)`; the BatchAddBar subscribes to the whole snapshot via
 * `useSelectedItems(store, type)`.
 *
 * Selection keys are the canonical `itemKey({type,id})` form (a
 * colon-separated `${type}:${id}` string) so the same store can hold a
 * mix of glazes and combinations if we ever go cross-type.
 */

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { parseItemKey, type ItemType } from "../utils/itemKey";

export interface PinnedTarget {
  kind: "piece" | "collection";
  id: string;
}

function parseAddTo(raw: string | null): PinnedTarget | null {
  if (!raw) return null;
  const [kind, id] = raw.split(":");
  if ((kind !== "piece" && kind !== "collection") || !id) return null;
  return { kind, id };
}

// =============================================================================
// SelectionStore — external store with per-key + global subscribers
// =============================================================================

/**
 * Per-key subscriptions are the whole point: tapping one card only
 * notifies that card's listener (plus the global listeners for the
 * BatchAddBar count/items), so React reconciliation stays local to the
 * one card that actually changed.
 *
 * A fresh `snapshot` Set is materialized on every commit so consumers
 * using `useSyncExternalStore` see a new reference and re-run their
 * selector — without this, `useSelectedItems` wouldn't recompute.
 */
export class SelectionStore {
  private set = new Set<string>();
  private snapshot: ReadonlySet<string> = new Set();
  private keyListeners = new Map<string, Set<() => void>>();
  private globalListeners = new Set<() => void>();

  has(key: string): boolean {
    return this.set.has(key);
  }

  getSnapshot = (): ReadonlySet<string> => this.snapshot;

  toggle = (key: string): void => {
    if (this.set.has(key)) this.set.delete(key);
    else this.set.add(key);
    this.commit([key]);
  };

  clear = (): void => {
    if (this.set.size === 0) return;
    const keys = Array.from(this.set);
    this.set.clear();
    this.commit(keys);
  };

  subscribeKey(key: string, listener: () => void): () => void {
    let s = this.keyListeners.get(key);
    if (!s) {
      s = new Set();
      this.keyListeners.set(key, s);
    }
    s.add(listener);
    return () => {
      const cur = this.keyListeners.get(key);
      if (!cur) return;
      cur.delete(listener);
      if (cur.size === 0) this.keyListeners.delete(key);
    };
  }

  subscribeAll = (listener: () => void): (() => void) => {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  };

  private commit(changedKeys: string[]): void {
    this.snapshot = new Set(this.set);
    for (const key of changedKeys) {
      const ls = this.keyListeners.get(key);
      if (ls) for (const l of ls) l();
    }
    for (const l of this.globalListeners) l();
  }
}

// =============================================================================
// Hook
// =============================================================================

export interface UseBatchSelectResult {
  /** Selection mode is active (URL-pinned OR user-enabled). */
  active: boolean;
  /** The pre-pinned target from the URL, if any. */
  pinned: PinnedTarget | null;
  /** Ref-stable store. Pass to cards; call `store.toggle(key)` from clicks. */
  store: SelectionStore;
  /** Turn on selection mode (no-op if already on). */
  enable: () => void;
  /** Turn off selection mode and clear the selection. */
  cancel: () => void;
  /** Strip the `?addTo=…` param from the URL (used after a successful add). */
  clearPinned: () => void;
}

export function useBatchSelect(): UseBatchSelectResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const pinned = useMemo(
    () => parseAddTo(searchParams.get("addTo")),
    [searchParams],
  );

  const [userActive, setUserActive] = useState(false);
  const storeRef = useRef<SelectionStore | null>(null);
  if (storeRef.current === null) storeRef.current = new SelectionStore();
  const store = storeRef.current;

  const active = userActive || pinned !== null;

  const enable = useCallback(() => setUserActive(true), []);
  const cancel = useCallback(() => {
    setUserActive(false);
    store.clear();
    // Also drop the pinned target — if the user explicitly cancels we want
    // to exit cleanly and not snap back into select mode on next re-render.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("addTo");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, store]);

  const clearPinned = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("addTo");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return { active, pinned, store, enable, cancel, clearPinned };
}

// =============================================================================
// Subscription helpers
// =============================================================================

/**
 * Subscribe a card to selection changes for ONE key. Re-renders only when
 * that key is toggled — not when any other card's selection changes.
 */
export function useIsSelected(store: SelectionStore, key: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeKey(key, listener),
    [store, key],
  );
  const getSnapshot = useCallback(() => store.has(key), [store, key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to the full selection snapshot. Use for the BatchAddBar. */
export function useSelectedSnapshot(store: SelectionStore): ReadonlySet<string> {
  return useSyncExternalStore(store.subscribeAll, store.getSnapshot, store.getSnapshot);
}

/** Subscribe to selection count only. */
export function useSelectedCount(store: SelectionStore): number {
  return useSelectedSnapshot(store).size;
}

// =============================================================================
// Decode helpers
// =============================================================================

export interface DecodedItem {
  type: ItemType;
  id: string;
}

/**
 * Convert the canonical `${type}:${id}` key set into structured items,
 * dropping anything that doesn't match `itemType`. Permissive of the
 * legacy `${type}-${id}` form via `parseItemKey`.
 */
export function decodeSelection(
  keys: ReadonlySet<string>,
  itemType: ItemType,
): DecodedItem[] {
  const out: DecodedItem[] = [];
  for (const key of keys) {
    const ref = parseItemKey(key);
    if (!ref || ref.type !== itemType) continue;
    out.push(ref);
  }
  return out;
}

/** Live decoded items for a given type. Re-renders on any selection change. */
export function useSelectedItems(
  store: SelectionStore,
  itemType: ItemType,
): DecodedItem[] {
  const snapshot = useSelectedSnapshot(store);
  return useMemo(() => decodeSelection(snapshot, itemType), [snapshot, itemType]);
}
