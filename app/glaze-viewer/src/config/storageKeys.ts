/**
 * Single source of truth for every localStorage / sessionStorage key the app
 * reads or writes. Prevents two pages from accidentally fighting over the
 * same key and makes it trivial to audit storage usage.
 */

export const STORAGE_KEYS = {
  // Guest data (logged-out users) \u2014 cleared once they sign in.
  GUEST_COLLECTIONS: "glaze-library-discover-projects",

  // Per-user my-glazes config snapshot. Used as `initialData` for the
  // TanStack Query cache so signed-in users don't see a flash of empty
  // owned/favorited state on first render. Suffixed with the user uid
  // (or "guest") at read/write time.
  MY_GLAZES_PREFIX: "glaze-library-my-glazes",

  // Saved filter state.
  COMBO_FILTERS: "glaze-library-combo-filters",

  // Glazes page UI state.
  GLAZE_FILTER: "glaze-library-glaze-filter",
  GLAZE_BRAND: "glaze-library-glaze-brand",
  GLAZE_SORT: "glaze-library-glaze-sort",
  GLAZE_SORT_ASC: "glaze-library-glaze-sort-asc",
  GLAZE_FAVES: "glaze-library-glaze-faves",

  // Session-scoped (sessionStorage).
  DISCOVER_UNSAVED_SESSION: "unsavedDiscoverSession",
  FILTER_EXPANDED: "glaze-library-filter-expanded",
  EXPLORE_EXPANDED_GLAZE: "explore-expanded-glaze",
  LOGIN_REDIRECT: "loginRedirect",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
