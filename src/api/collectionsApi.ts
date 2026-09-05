/**
 * Collections API client (was: "discover projects").
 *
 * Talks to `/api/collections/*` with a Firebase ID token via `authFetch`.
 * The server also exposes `/api/user-projects/*` aliases for older clients.
 *
 * Guests (no `userId` passed) get a localStorage fallback so the Discover
 * flow works without an account; signed-in users always hit the server.
 * The `userId` parameter is only used to choose between guest and signed-in
 * paths — it is NEVER sent to the server (the server reads the uid from
 * the verified Firebase token).
 */

import type { Collection, CollectionItem } from "../types/models";
import { STORAGE_KEYS } from "../config/storageKeys";
import { authFetch } from "../lib/authFetch";

// =============================================================================
// HTTP helpers
// =============================================================================

interface CollectionResponse {
  collection: Collection & { userId?: string };
}

interface CollectionsListResponse {
  collections: Array<Collection & { userId?: string }>;
}

function stripUserId(c: Collection & { userId?: string }): Collection {
  // The client model doesn't expose userId.
  const { userId, ...rest } = c;
  void userId;
  return rest;
}

function pickCollection(res: CollectionResponse): Collection {
  if (!res.collection) throw new Error("Empty collection response");
  return stripUserId(res.collection);
}

function pickList(res: CollectionsListResponse): Collection[] {
  return (res.collections ?? []).map(stripUserId);
}

// =============================================================================
// localStorage fallback (for guests)
// =============================================================================

function readLocal(): Collection[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GUEST_COLLECTIONS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeLocal(collections: Collection[]): void {
  localStorage.setItem(
    STORAGE_KEYS.GUEST_COLLECTIONS,
    JSON.stringify(collections),
  );
}

function genId(): string {
  return `collection-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// =============================================================================
// Public API
// =============================================================================

export async function getCollections(userId?: string): Promise<Collection[]> {
  if (!userId) return readLocal();
  try {
    const res = await fetch(`/api/collections/${userId}`);
    if (!res.ok) throw new Error("Failed to fetch collections");
    return pickList(await res.json());
  } catch (error) {
    console.error("Error fetching collections from server:", error);
    return [];
  }
}

export async function getCollection(
  id: string,
  userId?: string,
): Promise<Collection | null> {
  // Guests: look up in localStorage. Signed-in users hit the singular
  // endpoint, which returns piece-attached collections too (they are
  // intentionally hidden from the list endpoint used above). The fallback
  // path through the list is kept for the case where the singular request
  // 404s on a stale id we still have cached locally.
  if (!userId) {
    const list = readLocal();
    return list.find((c) => c.id === id) ?? null;
  }
  try {
    const res = await authFetch<CollectionResponse>(
      `/api/collections/item/${encodeURIComponent(id)}`,
    );
    return pickCollection(res);
  } catch (error) {
    console.error("Error fetching collection from server:", error);
    return null;
  }
}

export async function createCollection(
  name: string,
  likes: CollectionItem[],
  notes?: string,
  userId?: string,
  swipeProgress?: Collection["swipeProgress"],
): Promise<Collection> {
  if (!userId) {
    const list = readLocal();
    const now = new Date().toISOString();
    const created: Collection = {
      id: genId(),
      name,
      createdAt: now,
      updatedAt: now,
      likes,
      notes,
      swipeProgress,
    };
    list.unshift(created);
    writeLocal(list);
    return created;
  }
  const res = await authFetch<CollectionResponse>("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, notes, likes, swipeProgress }),
  });
  return pickCollection(res);
}

export async function updateCollection(
  id: string,
  updates: Partial<Pick<Collection, "name" | "notes" | "likes" | "swipeProgress">>,
  userId?: string,
): Promise<Collection | null> {
  if (!userId) {
    const list = readLocal();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeLocal(list);
    return list[idx];
  }
  try {
    const res = await authFetch<CollectionResponse>(`/api/collections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return pickCollection(res);
  } catch (error) {
    console.error("Error updating collection on server:", error);
    return null;
  }
}

export async function deleteCollection(
  id: string,
  userId?: string,
): Promise<boolean> {
  if (!userId) {
    const list = readLocal();
    const filtered = list.filter((c) => c.id !== id);
    if (filtered.length === list.length) return false;
    writeLocal(filtered);
    return true;
  }
  try {
    await authFetch<{ success: true }>(`/api/collections/${id}`, {
      method: "DELETE",
    });
    return true;
  } catch (error) {
    console.error("Error deleting collection on server:", error);
    return false;
  }
}
