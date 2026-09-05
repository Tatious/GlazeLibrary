/**
 * API functions for fetching glaze data
 * Currently fetches from static JSON files in public/data
 * Can be swapped to a real API endpoint later
 */

import type {
  Glaze,
  GlazeCombination,
  MyGlazesConfig,
} from "../types/models";

// Use Azure Blob Storage in production, local files in development
const AZURE_CDN_URL = import.meta.env.VITE_AZURE_CDN_URL || "";
const DATA_BASE_URL = AZURE_CDN_URL ? `${AZURE_CDN_URL}/data` : "/data";

// Export for use in image components
export const getImageUrl = (path: string): string => {
  if (!path) return "";
  // If already a full URL, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Otherwise prefix with CDN URL if available
  return AZURE_CDN_URL ? `${AZURE_CDN_URL}${path}` : path;
};

// =============================================================================
// Response Types (what the JSON files return)
// =============================================================================

interface GlazesResponse {
  version: string;
  lastUpdated: string;
  source: string;
  totalCount: number;
  glazes: Glaze[];
}

interface CombinationsResponse {
  version: string;
  lastUpdated: string;
  source: string;
  totalCount: number;
  combinations: GlazeCombination[];
}

// User-uploaded entry (one per upload, grouped by combinationId).
// Truth for "is this a single-glaze upload?" is `bottomGlazeId == null`.
// The `isSingleGlaze` field is kept as a server-derived hint for backward
// compatibility with older payloads on disk.
interface UserCombinationEntry {
  id: string;
  combinationId: string;
  userId: string;
  isSingleGlaze?: boolean;
  topGlazeId: string | null;
  bottomGlazeId: string | null;
  topCoats: number;
  bottomCoats: number;
  cone: string | null;
  clayBody: string | null;
  notes: string | null;
  tags: string[];
  imageUrl: string;
  imageUrls?: string[];
  createdAt: string;
}

interface UserCombinationsResponse {
  combinations: UserCombinationEntry[];
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch all glazes
 */
export async function fetchGlazes(): Promise<Glaze[]> {
  const response = await fetch(`${DATA_BASE_URL}/glazes.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch glazes: ${response.status}`);
  }

  const data: GlazesResponse = await response.json();
  return data.glazes;
}

/**
 * Fetch all combinations (scraped + user-uploaded)
 */
export async function fetchCombinations(): Promise<GlazeCombination[]> {
  // Let the browser/CDN cache this (multi-MB) file. Freshness is handled by
  // TanStack Query's staleTime + explicit invalidation after an upload — a
  // per-request `?v=Date.now()` buster was forcing a full re-download on every
  // call (and the detail page calls this several times), which was the main
  // cause of slow combination pages.
  const response = await fetch(`${DATA_BASE_URL}/combinations.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch combinations: ${response.status}`);
  }

  const data: CombinationsResponse = await response.json();
  const scrapedCombinations = data.combinations;

  // Create a map for quick lookup by ID
  const combinationsMap = new Map<string, GlazeCombination>();
  for (const combo of scrapedCombinations) {
    combinationsMap.set(combo.id, { ...combo });
  }

  // Fetch user-uploaded entries
  try {
    const userResponse = await fetch("/api/user-combinations");
    if (userResponse.ok) {
      const userData: UserCombinationsResponse = await userResponse.json();
      // Need glazes to resolve names
      const glazes = await fetchGlazes();
      const glazeMap = new Map(glazes.map((g) => [g.id, g]));

      // Helper to normalize combination ID to match scraped format
      // Scraped format: "amaco-c-01-over-c-47" (brand-topCode-over-bottomCode)
      // User format: "amaco-c-01-over-amaco-c-47" (topGlazeId-over-bottomGlazeId)
      const normalizeComboId = (id: string): string => {
        // Check if it matches the user format with brand repeated
        const match = id.match(/^(\w+)-(.+)-over-\1-(.+)$/);
        if (match) {
          // Convert "amaco-c-01-over-amaco-c-47" to "amaco-c-01-over-c-47"
          return `${match[1]}-${match[2]}-over-${match[3]}`;
        }
        return id;
      };

      // Group user entries by combinationId and merge into combinations
      for (const entry of userData.combinations) {
        // Single-glaze uploads (no bottom) belong on the glaze detail page,
        // not on a combination. Truth is `bottomGlazeId == null`.
        if (!entry.bottomGlazeId) continue;

        // Generate combinationId from glaze IDs if not present (backwards compatibility)
        const rawComboId =
          entry.combinationId ||
          (entry.topGlazeId && entry.bottomGlazeId
            ? `${entry.topGlazeId}-over-${entry.bottomGlazeId}`
            : `user-${entry.id}`);

        // Normalize to match scraped format
        const comboId = normalizeComboId(rawComboId);

        if (combinationsMap.has(comboId)) {
          // Add entry to existing combination (scraped or already processed user combo)
          const existing = combinationsMap.get(comboId)!;
          existing.entries = existing.entries || [];
          existing.entries.push(transformUserEntry(entry));
        } else {
          // Create new user combination
          const newCombo = createUserCombination(entry, comboId, glazeMap);
          combinationsMap.set(comboId, newCombo);
        }
      }
    }
  } catch (e) {
    // Server might not be running - that's ok, just use scraped data
    console.warn("Could not fetch user combinations:", e);
  }

  // Convert map to array, with user-only combinations first
  const allCombinations = Array.from(combinationsMap.values());
  const userOnly = allCombinations.filter((c) => c.source === "user");
  const withScraped = allCombinations.filter((c) => c.source !== "user");

  return [...userOnly.reverse(), ...withScraped];
}

/**
 * Transform a user entry to the CombinationEntry format
 */
function transformUserEntry(entry: UserCombinationEntry) {
  // Support both imageUrls array and legacy single imageUrl
  const urls = entry.imageUrls || (entry.imageUrl ? [entry.imageUrl] : []);

  return {
    id: entry.id,
    userId: entry.userId,
    submittedBy: "Community",
    isOfficial: false,
    topCoats: entry.topCoats || 2,
    bottomCoats: entry.bottomCoats || 2,
    cone: entry.cone || "Unknown",
    clayBody: entry.clayBody || null,
    notes: entry.notes || null,
    tags: entry.tags || [],
    photos: urls.map((url, index) => ({
      id: `${entry.id}-photo-${index}`,
      url,
      isCover: index === 0,
    })),
  };
}

/**
 * Create a new GlazeCombination from a user entry (when no scraped version exists)
 */
function createUserCombination(
  entry: UserCombinationEntry,
  comboId: string,
  glazeMap: Map<string, Glaze>,
): GlazeCombination {
  const topGlaze = glazeMap.get(entry.topGlazeId || "");
  const bottomGlaze = glazeMap.get(entry.bottomGlazeId || "");

  const topName = topGlaze?.displayName || "Unknown Glaze";
  const bottomName = bottomGlaze?.displayName || "Unknown Glaze";

  return {
    id: comboId,
    source: "user" as const,
    displayName: `${topName} over ${bottomName}`,
    topGlaze: {
      glazeId: entry.topGlazeId || "unknown",
      displayName: topName,
      code: topGlaze?.code,
    },
    bottomGlaze: {
      glazeId: entry.bottomGlazeId || "unknown",
      displayName: bottomName,
      code: bottomGlaze?.code,
    },
    entries: [transformUserEntry(entry)],
    createdAt: entry.createdAt,
  };
}

/**
 * A raw single-glaze user result (no bottom glaze)
 */
export interface UserGlazeResult {
  id: string;
  userId: string;
  glazeId: string;
  coats: number;
  cone: string | null;
  clayBody: string | null;
  notes: string | null;
  tags: string[];
  imageUrls: string[];
  createdAt: string;
}

/**
 * Fetch single-glaze community results for a specific glaze
 */
export async function fetchUserGlazeResults(
  glazeId: string,
): Promise<UserGlazeResult[]> {
  try {
    const response = await fetch("/api/user-combinations");
    if (!response.ok) return [];
    const data: UserCombinationsResponse = await response.json();
    return data.combinations
      .filter(
        (e) => !e.bottomGlazeId && e.topGlazeId === glazeId,
      )
      .map((e) => ({
        id: e.id,
        userId: e.userId,
        glazeId: e.topGlazeId!,
        coats: e.topCoats,
        cone: e.cone,
        clayBody: e.clayBody,
        notes: e.notes,
        tags: e.tags,
        imageUrls: e.imageUrls || (e.imageUrl ? [e.imageUrl] : []),
        createdAt: e.createdAt,
      }));
  } catch {
    return [];
  }
}

// =============================================================================
// Local Config API (my-glazes) — server-persisted, keyed by Firebase user_id
// =============================================================================

import { auth } from "../lib/firebase";
import { authFetch } from "../lib/authFetch";

/**
 * Fetch the signed-in user's my-glazes config from the server. Guests get a
 * default empty config — the GET endpoint is intentionally tolerant of
 * unauthenticated requests.
 */
export async function fetchMyGlazesConfig(): Promise<MyGlazesConfig> {
  try {
    // Skip authFetch's "throw if signed out" behavior by going through plain
    // fetch when there's no current user.
    const response = auth.currentUser
      ? await fetch("/api/config", {
          headers: {
            Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
          },
        })
      : await fetch("/api/config");
    if (!response.ok) throw new Error("Failed to fetch config");
    return (await response.json()) as MyGlazesConfig;
  } catch (error) {
    console.warn("Failed to fetch config, using default", error);
    return {
      version: "2.0",
      lastUpdated: new Date().toISOString(),
      glazes: {},
    };
  }
}

/**
 * Persist the my-glazes config to the server. No-op for guests so the UI can
 * still flip optimistically without blowing up. Throws on a non-2xx response
 * so the caller can roll back its optimistic update.
 */
export async function saveMyGlazesConfig(
  config: MyGlazesConfig,
): Promise<void> {
  if (!auth.currentUser) return; // guest: optimistic cache only
  await authFetch<{ success: true; config: MyGlazesConfig }>("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

/**
 * Check if a glaze is owned
 */
export function isGlazeOwned(config: MyGlazesConfig, glazeId: string): boolean {
  return config.glazes[glazeId]?.owned ?? false;
}

/**
 * Check if a glaze is favorite
 */
export function isGlazeFavorite(
  config: MyGlazesConfig,
  glazeId: string,
): boolean {
  return config.glazes[glazeId]?.favorite ?? false;
}

/**
 * Get count of owned glazes
 */
export function getOwnedGlazesCount(config: MyGlazesConfig): number {
  return Object.values(config.glazes).filter((g) => g.owned).length;
}

/**
 * Get count of favorite glazes
 */
export function getFavoriteGlazesCount(config: MyGlazesConfig): number {
  return Object.values(config.glazes).filter((g) => g.favorite).length;
}

/**
 * Check if a combination is favorite
 */
export function isCombinationFavorite(
  config: MyGlazesConfig,
  combinationId: string,
): boolean {
  return config.favoriteCombinations?.includes(combinationId) ?? false;
}

/**
 * Get count of favorite combinations
 */
export function getFavoriteCombinationsCount(config: MyGlazesConfig): number {
  return config.favoriteCombinations?.length ?? 0;
}

// Collections API has moved to src/api/collectionsApi.ts.
