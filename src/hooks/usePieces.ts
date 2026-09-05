/**
 * TanStack Query hooks for pottery pieces.
 *
 * Pages call these instead of `piecesApi` directly. Mutations invalidate
 * both the list query and (where useful) the single-piece query.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPiece,
  deletePiece,
  deleteStagePhoto,
  getPiece,
  listPieces,
  updatePiece,
  uploadStagePhoto,
} from "../api/piecesApi";
import { queryKeys } from "../api/queryKeys";
import { useAuth } from "./useAuth";
import type { PieceStage, PotteryPiece } from "../types/models";

export function usePieces() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.pieces(user?.uid),
    queryFn: () => (user ? listPieces(user.uid) : Promise.resolve([])),
    enabled: !!user,
  });
}

export function usePiece(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.piece(id) : ["pieces", "none"],
    queryFn: () => (id ? getPiece(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useCreatePiece() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; clayBody?: string | null; notes?: string | null; weight?: string | null }) => {
      if (!user) throw new Error("Not signed in");
      return createPiece(vars);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pieces(user?.uid) });
    },
  });
}

export function useUpdatePiece() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; updates: Partial<PotteryPiece> }) => {
      if (!user) throw new Error("Not signed in");
      return updatePiece(vars.id, vars.updates);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: queryKeys.pieces(user?.uid) });
      qc.setQueryData(queryKeys.piece(updated.id), updated);
    },
  });
}

export function useDeletePiece() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!user) throw new Error("Not signed in");
      return deletePiece(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pieces(user?.uid) });
    },
  });
}

export function useUploadStagePhoto() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      pieceId: string;
      file: File;
      stage: PieceStage;
      stageNotes?: string;
    }) => {
      if (!user) throw new Error("Not signed in");
      return uploadStagePhoto(vars.pieceId, {
        file: vars.file,
        stage: vars.stage,
        stageNotes: vars.stageNotes,
      });
    },
    onSuccess: ({ piece }) => {
      qc.invalidateQueries({ queryKey: queryKeys.pieces(user?.uid) });
      qc.setQueryData(queryKeys.piece(piece.id), piece);
    },
  });
}

export function useDeleteStagePhoto() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      pieceId: string;
      stage: PieceStage;
      photoUrl: string;
    }) => {
      if (!user) throw new Error("Not signed in");
      return deleteStagePhoto(vars.pieceId, {
        stage: vars.stage,
        photoUrl: vars.photoUrl,
      });
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: queryKeys.pieces(user?.uid) });
      qc.setQueryData(queryKeys.piece(updated.id), updated);
    },
  });
}
