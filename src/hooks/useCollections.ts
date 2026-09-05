/**
 * TanStack Query hooks for collections.
 *
 * Pages call these instead of touching `collectionsApi` directly; mutations
 * automatically invalidate the matching list query.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCollection,
  deleteCollection,
  getCollection,
  getCollections,
  updateCollection,
} from "../api/collectionsApi";
import { queryKeys } from "../api/queryKeys";
import { useAuth } from "./useAuth";
import type { Collection, CollectionItem } from "../types/models";

export function useCollections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.collections(user?.uid),
    queryFn: () => getCollections(user?.uid),
  });
}

export function useCollection(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: id ? ["collections", user?.uid, "byId", id] : ["collections", "none"],
    queryFn: () => (id ? getCollection(id, user?.uid) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      likes?: CollectionItem[];
      notes?: string;
      swipeProgress?: Collection["swipeProgress"];
    }) =>
      createCollection(
        vars.name,
        vars.likes ?? [],
        vars.notes,
        user?.uid,
        vars.swipeProgress,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.collections(user?.uid) });
    },
  });
}

export function useUpdateCollection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      updates: Partial<
        Pick<Collection, "name" | "notes" | "likes" | "swipeProgress">
      >;
    }) => updateCollection(vars.id, vars.updates, user?.uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.collections(user?.uid) });
    },
  });
}

export function useDeleteCollection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCollection(id, user?.uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.collections(user?.uid) });
    },
  });
}
