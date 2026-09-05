/**
 * Shared query keys for TanStack Query. Centralizing them prevents typo
 * mismatches between a `useQuery` and the `invalidateQueries` that should
 * refresh it.
 */

export const queryKeys = {
  glazes: ["glazes"] as const,
  glaze: (id: string) => ["glazes", id] as const,

  combinations: ["combinations"] as const,
  combination: (id: string) => ["combinations", id] as const,
  combinationsForGlaze: (glazeId: string) =>
    ["combinations", "forGlaze", glazeId] as const,
  userGlazeResults: (glazeId?: string) =>
    ["userGlazeResults", glazeId] as const,

  myGlazes: ["myGlazes"] as const,

  collections: (userId?: string) => ["collections", userId] as const,

  pieces: (userId?: string) => ["pieces", userId] as const,
  piece: (id: string) => ["pieces", "byId", id] as const,
};
