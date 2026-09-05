/**
 * Pieces API client — talks to /api/pieces/*.
 *
 * Read endpoints (`listPieces`, `getPiece`) are public and use plain fetch so
 * profile/detail pages work for any user. Mutating endpoints use `authFetch`
 * which attaches a Firebase ID token; the server derives the owner uid from
 * that token, never from request bodies/query strings.
 */

import type {
  MyPieces,
  PieceCollaborator,
  PotteryPiece,
  PieceStage,
  UserSummary,
} from "../types/models";
import { authFetch, authFetchForm, optionalAuthFetch } from "../lib/authFetch";

interface PieceResponse {
  piece: PotteryPiece;
}
interface PiecesListResponse {
  pieces: PotteryPiece[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function listPieces(userId: string): Promise<PotteryPiece[]> {
  const data = await jsonFetch<PiecesListResponse>(
    `/api/pieces?userId=${encodeURIComponent(userId)}`,
  );
  return data.pieces || [];
}

export async function getPiece(id: string): Promise<PotteryPiece> {
  const data = await optionalAuthFetch<PieceResponse & { viewerAccess: PotteryPiece["viewerAccess"] }>(
    `/api/pieces/${id}`,
  );
  return { ...data.piece, viewerAccess: data.viewerAccess };
}

export function listMyPieces(): Promise<MyPieces> {
  return authFetch<MyPieces>("/api/pieces/mine");
}

export async function listPieceCollaborators(id: string): Promise<PieceCollaborator[]> {
  const data = await authFetch<{ collaborators: PieceCollaborator[] }>(
    `/api/pieces/${id}/collaborators`,
  );
  return data.collaborators;
}

export async function searchPiecePeople(
  id: string,
  query: string,
): Promise<UserSummary[]> {
  const data = await authFetch<{ people: UserSummary[] }>(
    `/api/pieces/${id}/people/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  return data.people;
}

export async function invitePieceCollaborator(
  id: string,
  person: { userId: string } | { email: string },
): Promise<PieceCollaborator> {
  const data = await authFetch<{ collaborator: PieceCollaborator }>(
    `/api/pieces/${id}/invitations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(person),
    },
  );
  return data.collaborator;
}

export function respondToPieceInvitation(
  id: string,
  action: "accept" | "reject",
): Promise<{ piece?: PotteryPiece; success?: true }> {
  return authFetch(`/api/pieces/${id}/invitations/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

export function removePieceCollaborator(id: string, userId: string): Promise<void> {
  return authFetch(`/api/pieces/${id}/collaborators/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function createPiece(input: {
  name: string;
  clayBody?: string | null;
  notes?: string | null;
  weight?: string | null;
}): Promise<PotteryPiece> {
  const data = await authFetch<PieceResponse>("/api/pieces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.piece;
}

export async function updatePiece(
  id: string,
  updates: Partial<PotteryPiece>,
): Promise<PotteryPiece> {
  const data = await authFetch<PieceResponse>(`/api/pieces/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return data.piece;
}

export async function deletePiece(id: string): Promise<void> {
  await authFetch<{ success: true }>(`/api/pieces/${id}`, { method: "DELETE" });
}

// `toggleInspo` was removed when piece inspo moved to the piece's attached
// collection. Callers now mutate the inspo collection directly via
// `updateCollection(piece.inspoCollectionId, { likes: ... })`.

export async function uploadStagePhoto(
  pieceId: string,
  input: {
    file: File;
    stage: PieceStage;
    stageNotes?: string;
  },
): Promise<{ piece: PotteryPiece; imageUrl: string }> {
  const form = new FormData();
  form.append("image", input.file);
  form.append("stage", input.stage);
  if (input.stageNotes !== undefined) {
    form.append("stageNotes", input.stageNotes);
  }
  return authFetchForm<{ piece: PotteryPiece; imageUrl: string }>(
    `/api/pieces/${pieceId}/photo`,
    form,
  );
}

export async function deleteStagePhoto(
  pieceId: string,
  input: { stage: PieceStage; photoUrl: string },
): Promise<PotteryPiece> {
  const qs = new URLSearchParams({
    stage: input.stage,
    photoUrl: input.photoUrl,
  });
  const data = await authFetch<PieceResponse>(
    `/api/pieces/${pieceId}/photo?${qs}`,
    { method: "DELETE" },
  );
  return data.piece;
}
