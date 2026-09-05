/**
 * TanStack Query hook for a user's uploads (layered + single-glaze).
 *
 * Single-glaze uploads do NOT appear in `useCombinations` (they're not
 * combinations) \u2014 use this hook to render a user's full upload feed.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchUserUploads } from "../api/uploadsApi";

export function useUserUploads(userId: string | undefined) {
  return useQuery({
    queryKey: ["uploads", "user", userId],
    queryFn: () => (userId ? fetchUserUploads(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}
