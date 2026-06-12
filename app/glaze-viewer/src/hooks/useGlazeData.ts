/**
 * TanStack Query hooks for glaze data
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import {
  fetchGlazes,
  fetchCombinations,
  fetchCombinationById,
  fetchGlazeById,
  fetchCombinationsForGlaze,
  fetchUserGlazeResults,
  fetchMyGlazesConfig,
  saveMyGlazesConfig,
} from "../api/glazeApi";
import {
  fetchInventory,
  saveInventory,
  type InventoryResponse,
} from "../api/inventoryApi";
import { useAuth } from "./useAuth";
import { queryKeys } from "../api/queryKeys";
import { STORAGE_KEYS } from "../config/storageKeys";
import type {
  CombinationFilters,
  GlazeFilters,
  MyGlazesConfig,
} from "../types/models";

// =============================================================================
// Glaze Queries
// =============================================================================

/**
 * Fetch all glazes
 */
export function useGlazes() {
  return useQuery({
    queryKey: queryKeys.glazes,
    queryFn: fetchGlazes,
  });
}

/**
 * Fetch a single glaze by ID
 */
export function useGlaze(id: string) {
  return useQuery({
    queryKey: queryKeys.glaze(id),
    queryFn: () => fetchGlazeById(id),
    enabled: !!id,
  });
}

/**
 * Fetch glazes with filtering
 */
export function useFilteredGlazes(filters: GlazeFilters) {
  const { data: glazes, ...rest } = useGlazes();
  const myGlazes = useMyGlazes();

  const filtered = useMemo(() => {
    if (!glazes) return [];

    return glazes.filter((glaze) => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch =
          glaze.displayName.toLowerCase().includes(search) ||
          glaze.code.toLowerCase().includes(search) ||
          glaze.name.toLowerCase().includes(search) ||
          glaze.tags.some((t) => t.toLowerCase().includes(search));

        if (!matchesSearch) return false;
      }

      // Series filter
      if (filters.series && glaze.series !== filters.series) {
        return false;
      }

      // Brand filter
      if (filters.brand && glaze.brand !== filters.brand) {
        return false;
      }

      // Tags filter (any match)
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some((t) => glaze.tags.includes(t));
        if (!hasMatchingTag) return false;
      }

      // Only owned filter
      if (filters.onlyOwned && !myGlazes.glazes[glaze.id]?.owned) {
        return false;
      }

      return true;
    });
  }, [glazes, filters, myGlazes]);

  return { data: filtered, ...rest };
}

// =============================================================================
// Combination Queries
// =============================================================================

/**
 * Fetch all combinations
 */
export function useCombinations() {
  return useQuery({
    queryKey: queryKeys.combinations,
    queryFn: fetchCombinations,
  });
}

/**
 * Fetch a single combination by ID
 */
export function useCombination(id: string) {
  return useQuery({
    queryKey: queryKeys.combination(id),
    queryFn: () => fetchCombinationById(id),
    enabled: !!id,
  });
}

/**
 * Fetch combinations for a specific glaze
 */
export function useCombinationsForGlaze(glazeId: string) {
  return useQuery({
    queryKey: queryKeys.combinationsForGlaze(glazeId),
    queryFn: () => fetchCombinationsForGlaze(glazeId),
    enabled: !!glazeId,
  });
}

/**
 * Fetch single-glaze community results for a specific glaze
 */
export function useUserGlazeResults(glazeId: string | undefined) {
  return useQuery({
    queryKey: ["userGlazeResults", glazeId],
    queryFn: () => fetchUserGlazeResults(glazeId!),
    enabled: !!glazeId,
  });
}

/**
 * Fetch combinations with filtering
 */
export function useFilteredCombinations(filters: CombinationFilters) {
  const { data: combinations, ...rest } = useCombinations();
  const { data: glazes } = useGlazes();
  const myGlazes = useMyGlazes();

  // Build a lookup map for glaze tags
  const glazeTagsMap = useMemo(() => {
    if (!glazes) return new Map<string, string[]>();
    return new Map(glazes.map((g) => [g.id, g.tags || []]));
  }, [glazes]);

  const filtered = useMemo(() => {
    if (!combinations) return [];

    return combinations.filter((combo) => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        // Build display name from top/bottom glazes if not present
        const displayName =
          combo.displayName ||
          `${combo.topGlaze.displayName} over ${combo.bottomGlaze.displayName}`;

        // Include AI tags in search
        const aiTags = combo.ai?.tags || [];
        const allTags = [...(combo.tags || []), ...aiTags];

        const matchesSearch =
          displayName.toLowerCase().includes(search) ||
          combo.topGlaze.displayName.toLowerCase().includes(search) ||
          combo.bottomGlaze.displayName.toLowerCase().includes(search) ||
          allTags.some((t) => t.toLowerCase().includes(search)) ||
          combo.ai?.finish?.toLowerCase().includes(search) ||
          combo.ai?.style?.toLowerCase().includes(search) ||
          combo.ai?.clayBody?.toLowerCase().includes(search);

        if (!matchesSearch) return false;
      }

      // Top glaze filter
      if (filters.topGlazeId && combo.topGlaze.glazeId !== filters.topGlazeId) {
        return false;
      }

      // Bottom glaze filter
      if (
        filters.bottomGlazeId &&
        combo.bottomGlaze.glazeId !== filters.bottomGlazeId
      ) {
        return false;
      }

      // Cone filter - check entries for matching cone
      if (filters.cone) {
        const hasCone = combo.entries?.some((e) => e.cone === filters.cone);
        if (!hasCone) return false;
      }

      // Tags filter (any match) - check glaze tags, entry tags, and AI tags
      if (filters.tags && filters.tags.length > 0) {
        const topGlazeTags = glazeTagsMap.get(combo.topGlaze.glazeId) || [];
        const bottomGlazeTags =
          glazeTagsMap.get(combo.bottomGlaze.glazeId) || [];

        // Get tags from all entries
        const entryTags = combo.entries?.flatMap((e) => e.tags || []) || [];

        // Get AI-generated tags
        const aiTags = [
          ...(combo.ai?.tags || []),
          ...(combo.ai?.colors || []),
          ...(combo.ai?.effects || []),
          combo.ai?.finish,
          combo.ai?.style,
        ].filter(Boolean) as string[];

        const combinedTags = [
          ...topGlazeTags,
          ...bottomGlazeTags,
          ...entryTags,
          ...aiTags,
        ];
        const hasMatchingTag = filters.tags.some((t) =>
          combinedTags
            .map((tag) => tag.toLowerCase())
            .includes(t.toLowerCase()),
        );
        if (!hasMatchingTag) return false;
      }

      // Source filter
      if (filters.source && combo.source !== filters.source) {
        return false;
      }

      // Only official filter - check if any entry is official
      if (filters.onlyOfficial) {
        const hasOfficialEntry =
          combo.entries?.some((e) => e.isOfficial) ?? false;
        if (!hasOfficialEntry) return false;
      }

      // Ownership filter: "owned" requires both glazes owned, "unowned"
      // requires at least one missing. Undefined means no filter.
      if (filters.ownership) {
        const ownsTop = myGlazes.glazes[combo.topGlaze.glazeId]?.owned ?? false;
        const ownsBottom =
          myGlazes.glazes[combo.bottomGlaze.glazeId]?.owned ?? false;
        if (filters.ownership === "owned" && (!ownsTop || !ownsBottom)) {
          return false;
        }
        if (filters.ownership === "unowned" && ownsTop && ownsBottom) {
          return false;
        }
      }

      // Only favorite filter
      if (filters.onlyFavorite) {
        const isFavorite =
          myGlazes.favoriteCombinations?.includes(combo.id) ?? false;
        if (!isFavorite) return false;
      }

      return true;
    });
  }, [combinations, filters, myGlazes, glazeTagsMap]);

  return { data: filtered, ...rest };
}

// =============================================================================
// Shared inventory + per-user favorites
// -----------------------------------------------------------------------------
// Ownership ("which glazes does the studio have in stock?") is a single
// shared list. Anyone can read it; only admins write it. Personal favorites
// stay per-user.
//
// `useMyGlazes()` returns the merged view in the legacy `MyGlazesConfig`
// shape so existing call sites (which read `myGlazes.glazes[id].owned` and
// `.favorite`) keep working unchanged.
// =============================================================================

const DEFAULT_FAVORITES: MyGlazesConfig = {
  version: "2.0",
  lastUpdated: "",
  glazes: {},
  favoriteCombinations: [],
};

/** Shared inventory cache key — no uid; everyone sees the same list. */
const INVENTORY_KEY = ["inventory"] as const;

/** Per-user favorites cache key. */
function favoritesKey(uid?: string) {
  return ["myGlazes", uid ?? "guest"] as const;
}

/**
 * Per-uid localStorage key for the favorites snapshot used as TanStack
 * Query `initialData`. Keeps a signed-in user's favorited state visible on
 * first paint before the server round-trip lands.
 */
function favoritesLocalKey(uid?: string): string {
  return `${STORAGE_KEYS.MY_GLAZES_PREFIX}:${uid ?? "guest"}`;
}

/** Shared localStorage key for the inventory snapshot — same idea, no uid. */
const INVENTORY_LOCAL_KEY = `${STORAGE_KEYS.MY_GLAZES_PREFIX}:inventory`;

function readFavoritesLocal(uid?: string): MyGlazesConfig | undefined {
  try {
    const raw = localStorage.getItem(favoritesLocalKey(uid));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as MyGlazesConfig;
    if (!parsed || typeof parsed !== "object" || !parsed.glazes) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeFavoritesLocal(uid: string | undefined, config: MyGlazesConfig): void {
  try {
    localStorage.setItem(favoritesLocalKey(uid), JSON.stringify(config));
  } catch {
    // Storage full or disabled — non-fatal.
  }
}

function readInventoryLocal(): InventoryResponse | undefined {
  try {
    const raw = localStorage.getItem(INVENTORY_LOCAL_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as InventoryResponse;
    if (!parsed || !Array.isArray(parsed.ownedGlazeIds)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeInventoryLocal(inv: InventoryResponse): void {
  try {
    localStorage.setItem(INVENTORY_LOCAL_KEY, JSON.stringify(inv));
  } catch {
    // Non-fatal.
  }
}

/** Read the current favorites doc, falling back to the empty default. */
function readFavorites(queryClient: QueryClient, uid?: string): MyGlazesConfig {
  return (
    queryClient.getQueryData<MyGlazesConfig>(favoritesKey(uid)) ??
    DEFAULT_FAVORITES
  );
}

/** Read the current inventory, falling back to an empty list. */
function readInventory(queryClient: QueryClient): InventoryResponse | undefined {
  return queryClient.getQueryData<InventoryResponse>(INVENTORY_KEY);
}

/**
 * Merge inventory + favorites into the legacy `MyGlazesConfig` shape so
 * existing consumers (`myGlazes.glazes[id].owned` / `.favorite`) don't
 * need to change.
 *
 * `inv` may be `undefined` if the inventory fetch hasn't resolved yet \u2014
 * in that case we trust the legacy per-user `owned` flags as a best-effort
 * fallback (the inventory snapshot will arrive shortly and re-render). We
 * intentionally do NOT strip stale `owned: true` entries in that window:
 * doing so would briefly show every glaze as un-owned on first load,
 * which is the bug we're fixing here.
 */
function mergeConfig(
  inv: InventoryResponse | undefined,
  favs: MyGlazesConfig,
): MyGlazesConfig {
  if (!inv) {
    // Inventory not loaded yet \u2014 keep favorites as-is so users see the
    // last-known `owned` state instead of an empty grid.
    return favs;
  }
  const out: MyGlazesConfig["glazes"] = { ...favs.glazes };
  // Overlay shared ownership on top of per-user favorites. Inventory wins on
  // the `owned` field; favorites contribute `favorite` and `notes`.
  for (const id of inv.ownedGlazeIds) {
    const entry = out[id];
    out[id] = {
      owned: true,
      favorite: entry?.favorite ?? false,
      notes: entry?.notes,
    };
  }
  // Strip stale `owned: true` from the legacy per-user blob for glazes no
  // longer in shared inventory \u2014 otherwise un-stocking would silently
  // leave the old per-user flag in place.
  const ownedSet = new Set(inv.ownedGlazeIds);
  for (const id of Object.keys(out)) {
    if (!ownedSet.has(id) && out[id]?.owned) {
      out[id] = { ...out[id], owned: false };
    }
  }
  return {
    version: favs.version,
    lastUpdated:
      inv.updatedAt > favs.lastUpdated ? inv.updatedAt : favs.lastUpdated,
    glazes: out,
    favoriteCombinations: favs.favoriteCombinations,
  };
}

/**
 * Shared inventory query — public, no uid in the key. Hydrated from
 * localStorage for instant first paint and refetched on mount. Returns
 * `undefined` while neither localStorage nor the network has answered yet,
 * so the merge layer can distinguish "not loaded" from "empty".
 */
function useInventory(): InventoryResponse | undefined {
  const { data } = useQuery({
    queryKey: INVENTORY_KEY,
    queryFn: async () => {
      const inv = await fetchInventory();
      writeInventoryLocal(inv);
      return inv;
    },
    staleTime: 30 * 1000,
    initialData: () => readInventoryLocal(),
    initialDataUpdatedAt: 0,
  });
  return data;
}

/**
 * Per-user favorites query. Returns the default empty doc for guests; their
 * favorites stay client-side only until they sign in (handled by
 * `saveMyGlazesConfig`, which no-ops without a current user).
 */
function useFavoritesConfig(): MyGlazesConfig {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data } = useQuery({
    queryKey: favoritesKey(uid),
    queryFn: async () => {
      const config = await fetchMyGlazesConfig();
      writeFavoritesLocal(uid, config);
      return config;
    },
    staleTime: 30 * 1000,
    initialData: () => readFavoritesLocal(uid),
    initialDataUpdatedAt: 0,
  });
  return data ?? DEFAULT_FAVORITES;
}

/**
 * Hook to get the merged view of studio inventory + per-user favorites in
 * the legacy `MyGlazesConfig` shape. Existing callers stay unchanged.
 */
export function useMyGlazes(): MyGlazesConfig {
  const inventory = useInventory();
  const favorites = useFavoritesConfig();
  return useMemo(() => mergeConfig(inventory, favorites), [inventory, favorites]);
}

/**
 * Apply an optimistic favorites update, persist to the server, roll back
 * on failure. Used by both the glaze-favorite and combo-favorite toggles.
 */
function applyOptimisticFavoritesUpdate(
  queryClient: QueryClient,
  uid: string | undefined,
  next: MyGlazesConfig,
  prev: MyGlazesConfig,
  label: string,
): Promise<void> {
  const key = favoritesKey(uid);
  queryClient.setQueryData(key, next);
  writeFavoritesLocal(uid, next);
  return saveMyGlazesConfig(next).catch((error) => {
    queryClient.setQueryData(key, prev);
    writeFavoritesLocal(uid, prev);
    console.error(`Failed to ${label}:`, error);
  });
}

/**
 * Toggle a glaze's owned flag in the SHARED studio inventory. Optimistic
 * UI; rolls back on failure (which includes 403 for non-admin users). The
 * caller doesn't need to gate on admin status — the server is the source of
 * truth, and a failed write just snaps the UI back.
 */
export function useToggleGlazeOwned() {
  const queryClient = useQueryClient();

  return useCallback(
    async (glazeId: string) => {
      // Make sure we never POST a partial inventory derived from a
      // not-yet-loaded cache \u2014 that would wipe other admins' work. If the
      // inventory hasn't been fetched yet, kick the query off and wait.
      let prev = readInventory(queryClient);
      if (!prev) {
        try {
          prev = await queryClient.fetchQuery({
            queryKey: INVENTORY_KEY,
            queryFn: fetchInventory,
          });
        } catch (error) {
          console.error("Failed to load inventory before toggle:", error);
          return;
        }
      }
      if (!prev) return;
      const owned = new Set(prev.ownedGlazeIds);
      if (owned.has(glazeId)) owned.delete(glazeId);
      else owned.add(glazeId);
      const next: InventoryResponse = {
        ...prev,
        ownedGlazeIds: Array.from(owned).sort(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData(INVENTORY_KEY, next);
      writeInventoryLocal(next);
      try {
        const server = await saveInventory(next.ownedGlazeIds);
        // Server may dedup/normalize; reconcile with its response.
        queryClient.setQueryData(INVENTORY_KEY, server);
        writeInventoryLocal(server);
      } catch (error) {
        queryClient.setQueryData(INVENTORY_KEY, prev);
        writeInventoryLocal(prev);
        console.error("Failed to toggle owned:", error);
      }
    },
    [queryClient],
  );
}

/**
 * Toggle a glaze's favorite flag. Per-user; doesn't touch shared inventory.
 */
export function useToggleGlazeFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid;

  return useCallback(
    (glazeId: string) => {
      const prev = readFavorites(queryClient, uid);
      const prevEntry = prev.glazes[glazeId];
      const next: MyGlazesConfig = {
        ...prev,
        lastUpdated: new Date().toISOString(),
        glazes: {
          ...prev.glazes,
          [glazeId]: {
            // Don't carry `owned` here — it lives in shared inventory now.
            // We keep the field for shape-compat but always set it to false;
            // `mergeConfig` overlays the real value on read.
            owned: false,
            favorite: !(prevEntry?.favorite ?? false),
            notes: prevEntry?.notes,
          },
        },
      };
      return applyOptimisticFavoritesUpdate(
        queryClient,
        uid,
        next,
        prev,
        "toggle favorite",
      );
    },
    [queryClient, uid],
  );
}

/**
 * Toggle a combination's favorite flag.
 */
export function useToggleCombinationFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid;

  return useCallback(
    (combinationId: string) => {
      const prev = readFavorites(queryClient, uid);
      const favs = prev.favoriteCombinations ?? [];
      const newFavs = favs.includes(combinationId)
        ? favs.filter((id) => id !== combinationId)
        : [...favs, combinationId];
      const next: MyGlazesConfig = {
        ...prev,
        lastUpdated: new Date().toISOString(),
        favoriteCombinations: newFavs,
      };
      return applyOptimisticFavoritesUpdate(
        queryClient,
        uid,
        next,
        prev,
        "toggle combination favorite",
      );
    },
    [queryClient, uid],
  );
}

/**
 * Hook to import/export my glazes config
 */
export function useMyGlazesManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid;

  const importConfig = useCallback(
    async (json: string) => {
      const config = JSON.parse(json) as MyGlazesConfig;
      const prev = readFavorites(queryClient, uid);
      await applyOptimisticFavoritesUpdate(
        queryClient,
        uid,
        config,
        prev,
        "import config",
      );
    },
    [queryClient, uid],
  );

  const exportConfig = useCallback(() => {
    return JSON.stringify(readFavorites(queryClient, uid), null, 2);
  }, [queryClient, uid]);

  const resetConfig = useCallback(async () => {
    const prev = readFavorites(queryClient, uid);
    const next: MyGlazesConfig = {
      ...DEFAULT_FAVORITES,
      lastUpdated: new Date().toISOString(),
    };
    await applyOptimisticFavoritesUpdate(queryClient, uid, next, prev, "reset config");
  }, [queryClient, uid]);

  return { importConfig, exportConfig, resetConfig };
}

// =============================================================================
// Derived Data Hooks
// =============================================================================

/**
 * Get unique tags from all glazes, combination entries, and AI analysis
 */
export function useGlazeTags() {
  const { data: glazes } = useGlazes();
  const { data: combinations } = useCombinations();

  return useMemo(() => {
    const tags = new Set<string>();

    // Add tags from glazes
    if (glazes) {
      glazes.forEach((g) => {
        g.tags?.forEach((tag) => tags.add(tag));
      });
    }

    // Add tags from combination entries and AI analysis
    if (combinations) {
      combinations.forEach((c) => {
        // Entry tags
        c.entries?.forEach((entry) => {
          entry.tags?.forEach((tag: string) => tags.add(tag));
        });

        // AI-generated tags
        if (c.ai) {
          c.ai.tags?.forEach((tag) => tags.add(tag));
          c.ai.colors?.forEach((color) => tags.add(color));
          c.ai.effects?.forEach((effect) => tags.add(effect));
          if (c.ai.finish) tags.add(c.ai.finish);
          if (c.ai.style) tags.add(c.ai.style);
        }
      });
    }

    return Array.from(tags).sort();
  }, [glazes, combinations]);
}

/**
 * Get statistics about the glaze library
 */
export function useGlazeStats() {
  const { data: glazes } = useGlazes();
  const { data: combinations } = useCombinations();
  const myGlazes = useMyGlazes();

  return useMemo(() => {
    // Only count owned/favorite glazes that actually exist in the glazes list
    const glazeIds = new Set(glazes?.map((g) => g.id) ?? []);
    const ownedCount = Object.entries(myGlazes.glazes).filter(
      ([id, g]) => g.owned && glazeIds.has(id),
    ).length;
    const favoriteCount = Object.entries(myGlazes.glazes).filter(
      ([id, g]) => g.favorite && glazeIds.has(id),
    ).length;

    return {
      totalGlazes: glazes?.length ?? 0,
      totalCombinations: combinations?.length ?? 0,
      ownedGlazes: ownedCount,
      favoriteGlazes: favoriteCount,
      availableCombinations:
        combinations?.filter(
          (c) =>
            (myGlazes.glazes[c.topGlaze.glazeId]?.owned ?? false) &&
            (myGlazes.glazes[c.bottomGlaze.glazeId]?.owned ?? false),
        ).length ?? 0,
    };
  }, [glazes, combinations, myGlazes]);
}
