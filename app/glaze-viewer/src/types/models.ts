// =============================================================================
// GLAZE LIBRARY TYPES
// =============================================================================

/**
 * Individual image for a glaze product
 */
export interface GlazeImage {
  id: string; // e.g., "c-01-img-1"
  localPath: string; // e.g., "/images/glazes/amaco/c-01.jpg"
  originalUrl: string; // Original source URL
  type:
    | "product"
    | "gallery"
    | "variation"
    | "main"
    | "stencil"
    | "srcset"
    | "unknown";
  isPrimary: boolean; // Is this the main display image?
  alt?: string; // Alt text from source

  // Enriched metadata (from AI enrichment pipeline)
  cone?: string; // Cone temperature for this specific image (e.g., "6", "10")
  atmosphere?: "oxidation" | "reduction"; // Firing atmosphere
  clayBody?: string; // Clay body type (e.g., "speckled-white", "dark")
  imageType?:
    | "primary"
    | "cone-variation"
    | "clay-variation"
    | "combination"
    | "coat-variation"
    | "variation";
  coats?: number; // Number of coats shown
  comboType?: "over" | "under"; // For combination shots
  comboGlaze?: string; // Other glaze in combination
}

/**
 * Individual glaze product
 */
export interface Glaze {
  id: string; // e.g., "amaco-pc-30-temmoku"
  brand: string; // e.g., "AMACO"
  series: string; // e.g., "Potter's Choice", "Celadon", "Shino"
  code: string; // e.g., "PC-30"
  name: string; // e.g., "Temmoku"
  displayName: string; // e.g., "PC-30 Temmoku"
  cone: string[]; // e.g., ["5", "6"]
  tags: string[]; // e.g., ["brown", "iron-based", "flux"]
  productUrl?: string; // Link to manufacturer page
  images: GlazeImage[]; // All product images
  source: GlazeSource; // Where this data came from
  description?: string; // Product description
}

/**
 * Sources for glaze data
 */
export type GlazeSource = "amaco" | "seattle-pottery" | "user" | "other";

/**
 * Glaze layer in a combination (v3.0)
 * Coats are now stored per-entry, not per-layer
 */
export interface GlazeLayer {
  glazeId: string; // Reference to Glaze.id
  code?: string; // e.g., "PC-30" (denormalized)
  displayName: string; // Denormalized for easy display
  coats?: number; // Legacy - now in CombinationEntry
}

/**
 * A single entry/submission for a glaze combination
 * Multiple users can submit entries for the same glaze pair
 */
export interface CombinationEntry {
  id: string; // e.g., "ccc05e363b33"
  userId?: string; // User ID of submitter (for user-submitted entries)
  submittedBy: string;
  isOfficial: boolean; // Official manufacturer test vs community
  topCoats: number;
  bottomCoats: number;
  clayBody: string | null; // Clay type or null if N/A
  cone: string; // Firing cone, e.g., "6"
  notes?: string | null; // User notes
  tags?: string[]; // User-added tags
  photos: CombinationPhoto[];
}

/**
 * A combination of two glazes layered together (v3.0 multi-entry structure)
 * Contains multiple entries/submissions from different users
 */
export interface GlazeCombination {
  id: string; // e.g., "amaco-pc30-over-pc47"
  source?: GlazeSource;
  displayName?: string; // e.g., "PC-30 Temmoku over PC-47 Emerald Falls"

  topGlaze: GlazeLayer;
  bottomGlaze: GlazeLayer;

  entries: CombinationEntry[]; // All submissions for this combination

  tags?: string[]; // For filtering: colors, effects, etc.

  // AI-generated enrichment data
  ai?: {
    colors?: string[];
    finish?: string;
    effects?: string[];
    style?: string;
    tags?: string[];
    clayBody?: string;
    clayBodyConfidence?: string;
    analyzedAt?: string;
  };

  createdAt?: string; // ISO date string
  updatedAt?: string;
}

/**
 * Photo attached to a combination
 */
export interface CombinationPhoto {
  id: string;
  url: string; // Relative path from public folder
  thumbnailUrl?: string;
  isCover: boolean; // Primary display photo
  submittedBy?: string;
  caption?: string;
}

// =============================================================================
// ADMIN CONFIG TYPES
// =============================================================================

/**
 * Individual glaze entry in user's config
 */
export interface MyGlazeEntry {
  owned: boolean;
  favorite?: boolean;
  notes?: string;
}

/**
 * User's studio inventory - glazes they own and combinations they've favorited
 */
export interface MyGlazesConfig {
  version: string;
  lastUpdated: string;
  glazes: Record<string, MyGlazeEntry>; // glazeId -> entry with owned/favorite/notes
  favoriteCombinations?: string[]; // Array of combination IDs
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface GlazeDataResponse {
  glazes: Glaze[];
  combinations: GlazeCombination[];
  lastUpdated: string;
}

export interface GlazesIndexResponse {
  glazes: Glaze[];
  totalCount: number;
}

export interface CombinationsIndexResponse {
  combinations: GlazeCombination[];
  totalCount: number;
}

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface CombinationFilters {
  search?: string;
  topGlazeId?: string;
  bottomGlazeId?: string;
  cone?: string;
  tags?: string[];
  source?: GlazeSource;
  // "owned" = studio owns both glazes; "unowned" = at least one not owned;
  // undefined = no ownership filter (all combos). Mirrors the 3-way segmented
  // control on the Glazes page so both surfaces speak the same language.
  ownership?: "owned" | "unowned";
  onlyOfficial?: boolean;
  onlyFavorite?: boolean; // Filter to favorited combinations
}

export interface GlazeFilters {
  search?: string;
  series?: string;
  brand?: string;
  cone?: string;
  tags?: string[];
  onlyOwned?: boolean;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export type SortOption =
  | "name"
  | "newest"
  | "popular"
  | "topGlaze"
  | "bottomGlaze";

export interface AppState {
  sortBy: SortOption;
  filters: CombinationFilters;
}

// =============================================================================
// COLLECTION TYPES (was: DiscoverProject)
// =============================================================================

/**
 * A single item saved on a Collection — either a glaze or a combination.
 * The `likedAt` name is preserved for backwards compatibility with persisted data.
 */
export interface CollectionItem {
  type: "glaze" | "combination";
  id: string;
  likedAt: string; // ISO date
}

/**
 * A user-curated set of glazes and combinations — inspiration for one piece.
 * Field name `likes` is preserved on the wire / on disk for backwards compat.
 */
export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  likes: CollectionItem[];
  notes?: string;
  swipeProgress?: {
    rejected: string[]; // Item keys like "glaze:abc123" that were swiped left
    shuffleSeed: number;
  };
  // Set when this collection is a piece's inspo board. Such collections are
  // hidden from the standalone Collections list and cascade-deleted with the
  // piece. The pointer travels both ways: piece.inspoCollectionId ↔ this.
  attachedToPieceId?: string | null;
}

// =============================================================================
// POTTERY PIECE TYPES
// =============================================================================

export type PieceStage = "greenware" | "bisqueware" | "fired";

export interface PieceStageRecord {
  stage: PieceStage;
  date: string;
  photos: string[];
  notes?: string | null;
}

export interface PieceGlaze {
  label?: string;        // application zone, e.g. "Inside", "Outside", "Rim"
  glazeId: string;       // base / single glaze
  coats?: number;
  overGlazeId?: string;  // second glaze applied on top of the base
  overCoats?: number;
}

/**
 * A single glaze or combination saved as inspiration on a piece.
 *
 * @deprecated Piece inspo now lives in the piece's attached `Collection`
 * (via `inspoCollectionId` → `Collection.likes`). The type is kept around
 * only because a few helpers still type their function args as this shape;
 * structurally identical to `CollectionItem` minus the `likedAt`/`addedAt`
 * field name. New code should use `CollectionItem` directly.
 */
export interface GlazeInspoItem {
  type: "glaze" | "combination";
  id: string;
  addedAt: string; // ISO date
}

export interface PotteryPiece {
  id: string;
  userId: string;
  name: string;
  clayBody?: string | null;
  notes?: string | null;
  /**
   * Original (pre-firing) weight as the user typed it, e.g. "250g" or
   * "8 oz". Free-form text so we don't pick a unit for the user.
   */
  weight?: string | null;
  currentStage: PieceStage;
  stageRecords: PieceStageRecord[];
  glazes: PieceGlaze[];
  /**
   * Every piece points at exactly one hidden `Collection` that holds its
   * glaze inspo. Set eagerly on piece create; never null after the server's
   * one-shot backfill runs.
   */
  inspoCollectionId: string;
  /**
   * Read-only denormalization of `Collection.likes` for the piece's inspo
   * collection. The server inlines it on every GET so the UI doesn't have
   * to make a second request just to render the inspo grid. Mutations go
   * through the collections API (`updateCollection(inspoCollectionId, ...)`).
   */
  inspoLikes: CollectionItem[];
  publishedEntries: { comboId: string; entryId: string }[];
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}
