/**
 * Uploads API client — talks to /api/upload + /api/user-combinations/*.
 *
 * Mutations attach a Firebase ID token via `authFetchForm`; the server
 * derives the owner uid from that token. The list endpoint is public
 * (it backs the community feed) so it uses plain fetch.
 *
 * Photo ownership: when an upload references a piece's photo URL via
 * `slotOrder`, the server transparently copies the file into the upload's
 * own namespace. The client never needs to think about it.
 */

import type { Glaze } from "../types/models";
import { authFetch, authFetchForm } from "../lib/authFetch";

interface UploadResponse {
  success: true;
  combinationId: string;
  entryId: string;
  /** Derived server-side from `bottomGlazeId == null`. Don't rely on it. */
  isSingleGlaze?: boolean;
  /** Set when the server linked this entry back to a piece. */
  pieceId?: string | null;
}

/**
 * Raw upload row as returned by GET /api/user-combinations.
 * `bottomGlazeId == null` means a single-glaze result (no layered combo).
 */
export interface UserUpload {
  id: string;
  userId: string;
  combinationId: string;
  topGlazeId: string | null;
  bottomGlazeId: string | null;
  topCoats: number;
  bottomCoats: number;
  cone: string | null;
  clayBody: string | null;
  notes: string | null;
  tags: string[];
  imageUrl: string;
  imageUrls: string[];
  createdAt: string;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Slot order item: either a freshly uploaded file (referenced by index into
 * the FormData "images" array) or an existing image URL we're keeping.
 */
export type SlotOrderItem = { t: "f"; i: number } | { t: "e"; u: string };

export interface UploadInput {
  topGlazeId: string;
  bottomGlazeId: string | null;
  topCoats: number;
  bottomCoats: number;
  cone: string;
  clayBody: string;
  notes: string;
  tags: string[];
  files: File[];
  slotOrder: SlotOrderItem[];
  /** If set, server links this upload back to that piece's `publishedEntries`. */
  pieceId?: string;
}

function buildForm(input: UploadInput): FormData {
  const form = new FormData();
  for (const file of input.files) form.append("images", file);
  form.append("slotOrder", JSON.stringify(input.slotOrder));
  form.append("topGlazeId", input.topGlazeId);
  form.append("bottomGlazeId", input.bottomGlazeId || "");
  form.append("topCoats", String(input.topCoats));
  form.append("bottomCoats", String(input.bottomCoats));
  form.append("cone", input.cone);
  form.append("clayBody", input.clayBody);
  form.append("notes", input.notes);
  form.append("tags", JSON.stringify(input.tags));
  if (input.pieceId) form.append("pieceId", input.pieceId);
  return form;
}

export async function createUpload(
  input: UploadInput,
): Promise<UploadResponse> {
  return authFetchForm<UploadResponse>("/api/upload", buildForm(input));
}

export async function updateUpload(
  entryId: string,
  input: UploadInput,
): Promise<UploadResponse> {
  return authFetchForm<UploadResponse>(
    `/api/user-combinations/${entryId}`,
    buildForm(input),
    "PUT",
  );
}

export async function deleteUpload(entryId: string): Promise<void> {
  await authFetch<{ success: true }>(`/api/user-combinations/${entryId}`, {
    method: "DELETE",
  });
}

/**
 * Fetch a single upload by id (helper used by the edit form so it doesn't have
 * to scan the whole list). Reads from the public list endpoint.
 */
export async function fetchUpload(entryId: string): Promise<UserUpload | null> {
  const data = await jsonFetch<{ combinations: UserUpload[] }>(
    "/api/user-combinations",
  );
  return (data.combinations || []).find((u) => u.id === entryId) ?? null;
}

/**
 * Fetch every upload (layered + single-glaze) belonging to one user, newest
 * first. Reads from the public list endpoint and filters client-side.
 */
export async function fetchUserUploads(userId: string): Promise<UserUpload[]> {
  const data = await jsonFetch<{ combinations: UserUpload[] }>(
    "/api/user-combinations",
  );
  return (data.combinations || [])
    .filter((u) => u.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * What to put in a card / link for one upload, no matter whether it's a
 * single-glaze result or a layered combo.
 */
export interface UploadCard {
  entryId: string;
  isSingleGlaze: boolean;
  imageUrl: string;
  displayName: string;
  meta: string;
  /** Router path to navigate to when the card is clicked. */
  linkTo: string;
}

/**
 * Build a display-ready card from a raw upload + the glaze lookup. Single-
 * glaze uploads link to the glaze detail page; layered uploads link to the
 * combination detail page (with `?entry=` so the right entry is selected).
 */
export function toUploadCard(
  upload: UserUpload,
  glazes: Glaze[],
): UploadCard {
  const top = upload.topGlazeId
    ? glazes.find((g) => g.id === upload.topGlazeId)
    : undefined;
  const bottom = upload.bottomGlazeId
    ? glazes.find((g) => g.id === upload.bottomGlazeId)
    : undefined;
  const isSingleGlaze = !upload.bottomGlazeId;

  if (isSingleGlaze) {
    const name = top?.displayName ?? top?.code ?? "Single glaze";
    return {
      entryId: upload.id,
      isSingleGlaze: true,
      imageUrl: upload.imageUrls[0] ?? upload.imageUrl,
      displayName: name,
      meta: `Cone ${upload.cone ?? "?"} • ${upload.topCoats} coats`,
      linkTo: upload.topGlazeId
        ? `/glaze/${upload.topGlazeId}`
        : `/combination/${upload.combinationId}?entry=${upload.id}`,
    };
  }

  const topName = top?.displayName ?? top?.code ?? "Unknown";
  const bottomName = bottom?.displayName ?? bottom?.code ?? "Unknown";
  return {
    entryId: upload.id,
    isSingleGlaze: false,
    imageUrl: upload.imageUrls[0] ?? upload.imageUrl,
    displayName: `${topName} over ${bottomName}`,
    meta: `Cone ${upload.cone ?? "?"} • ${upload.topCoats}/${upload.bottomCoats} coats`,
    linkTo: `/combination/${upload.combinationId}?entry=${upload.id}`,
  };
}
