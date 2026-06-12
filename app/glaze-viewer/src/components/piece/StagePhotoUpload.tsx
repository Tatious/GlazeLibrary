/**
 * Stage-photo uploader used inside the piece detail timeline.
 *
 * Owns: the file input, optimistic "uploading…" state, the horizontal
 * photo scroll strip (with live i/n counter), the inline stage-notes
 * editor, and the piece-photo delete via the fullscreen lightbox.
 *
 * Does NOT own: piece state. The parent owns the `piece` and is notified via
 * `onUploaded` whenever the photo set or stage notes change.
 *
 * Originally an inline ~210 LOC block inside PieceDetailPage; extracted in
 * Phase 3 so PieceDetailPage stays focused on the page-level layout/glaze
 * plan/inspo/published-results sections.
 */

import { useRef, useState } from "react";
import {
  deleteStagePhoto,
  updatePiece,
  uploadStagePhoto,
} from "../../api/piecesApi";
import { STAGE_LABELS } from "../../lib/pieceStages";
import type { PieceStage, PotteryPiece } from "../../types/models";
import { Camera, Pencil } from "../Icons";
import { ImageLightbox } from "../ImageLightbox";

interface StagePhotoUploadProps {
  piece: PotteryPiece;
  stage: PieceStage;
  onUploaded: (updated: PotteryPiece) => void;
}

export function StagePhotoUpload({
  piece,
  stage,
  onUploaded,
}: StagePhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageNotes, setStageNotes] = useState(
    piece.stageRecords.find((r) => r.stage === stage)?.notes || "",
  );
  const [showNotesInput, setShowNotesInput] = useState(false);
  // Index of the photo open in the fullscreen viewer, or null when closed.
  // Lives here (not on the parent) because each stage owns its own photos.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const record = piece.stageRecords.find((r) => r.stage === stage);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const { piece: updated } = await uploadStagePhoto(piece.id, {
        file,
        stage,
      });
      onUploaded(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveNotes = async () => {
    try {
      const stageRecord = piece.stageRecords.find((r) => r.stage === stage);
      const updatedRecords = stageRecord
        ? piece.stageRecords.map((r) =>
            r.stage === stage ? { ...r, notes: stageNotes || null } : r,
          )
        : [
            ...piece.stageRecords,
            {
              stage,
              date: new Date().toISOString(),
              photos: [],
              notes: stageNotes || null,
            },
          ];
      const updated = await updatePiece(piece.id, {
        stageRecords: updatedRecords,
      });
      onUploaded(updated);
      setShowNotesInput(false);
    } catch (err) {
      console.error("Failed to save notes", err);
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    try {
      const updated = await deleteStagePhoto(piece.id, { stage, photoUrl });
      onUploaded(updated);
      // After delete, advance the viewer to the next photo if any remain,
      // or close the lightbox. We look at the updated record's photo count
      // so we don't try to index past the end.
      const remaining = updated.stageRecords.find((r) => r.stage === stage)?.photos.length ?? 0;
      if (remaining === 0) setViewerIndex(null);
      else setViewerIndex((i) => (i === null ? null : Math.min(i, remaining - 1)));
    } catch (err) {
      console.error("Failed to delete photo:", err);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Photos. Tiles are always a perfect square so the grid stays
          uniform regardless of photo orientation. The photo inside uses
          `object-contain` so its native aspect is preserved (never
          cropped); the otherwise-empty letterbox space is filled with a
          blurred, dimmed copy of the same image as an ambient backplate
          (Apple Music / Spotify album-art treatment) so no flat negative
          space sits next to the photo. Tap any photo opens the
          fullscreen lightbox at native aspect.
          - 1 photo: centered hero, capped at 55vh wide.
          - 2+: square grid (2-col mobile, 3-col sm+). */}
      {record && record.photos.length === 1 && (
        <button
          type="button"
          onClick={() => setViewerIndex(0)}
          className="relative mb-2 mx-auto block w-full max-w-[55vh] aspect-square rounded-lg overflow-hidden bg-clay-100 dark:bg-earth-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400"
          aria-label={`View ${STAGE_LABELS[stage]} photo 1`}
        >
          {/* Ambient blurred backplate. Heavy blur + extra scale hides
              the soft fringe at the tile edge; bumped saturation keeps
              the warm pottery tones reading through the dim. Lighter in
              light mode so it doesn't sit heavy on the white card. */}
          <img
            src={record.photos[0]}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl saturate-250 brightness-275 pointer-events-none"
          />
          <img
            src={record.photos[0]}
            alt={`${STAGE_LABELS[stage]} photo 1`}
            className="relative w-full h-full object-contain pointer-events-none"
          />
        </button>
      )}
      {record && record.photos.length > 1 && (
        <div className="mb-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {record.photos.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setViewerIndex(i)}
              className="relative aspect-square rounded-lg overflow-hidden bg-clay-100 dark:bg-earth-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400"
              aria-label={`View ${STAGE_LABELS[stage]} photo ${i + 1}`}
            >
              <img
                src={url}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl saturate-150 brightness-90 dark:brightness-75 pointer-events-none"
              />
              <img
                src={url}
                alt={`${STAGE_LABELS[stage]} photo ${i + 1}`}
                className="relative w-full h-full object-contain pointer-events-none"
              />
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs mb-2">{error}</p>
      )}

      {/* Actions — always live. Stage work (add photo, jot notes, advance)
          is the page's most-frequent activity, so we don't gate it behind
          an edit-mode toggle. The only destructive action (photo delete)
          lives in the fullscreen lightbox with a two-tap confirm. */}
      <div className="flex items-center gap-4 text-sm">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 font-medium text-terracotta-600 dark:text-terracotta-400 hover:text-terracotta-700 dark:hover:text-terracotta-300 transition-colors disabled:opacity-50"
        >
          <Camera className="w-4 h-4 shrink-0" />
          {isUploading ? "Uploading…" : "Add photo"}
        </button>

        <button
          type="button"
          onClick={() => setShowNotesInput((v) => !v)}
          className="inline-flex items-center gap-1.5 font-medium text-clay-500 dark:text-clay-400 hover:text-clay-700 dark:hover:text-clay-200 transition-colors"
        >
          <Pencil className="w-4 h-4 shrink-0" />
          {record?.notes ? "Edit notes" : "Add notes"}
        </button>
      </div>

      {/* Notes display — visible whenever notes exist and the editor
          isn't open. */}
      {record?.notes && !showNotesInput && (
        <p className="mt-2 text-sm text-clay-600 dark:text-clay-400 italic">
          {record.notes}
        </p>
      )}

      {/* Notes input — toggled by the "Add/Edit notes" chip above. */}
      {showNotesInput && (
        <div className="mt-3 space-y-2">
          <textarea
            value={stageNotes}
            onChange={(e) => setStageNotes(e.target.value)}
            rows={2}
            placeholder="Notes for this stage..."
            className="w-full px-3 py-2 text-sm rounded-lg border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-700 text-clay-800 dark:text-clay-200 placeholder-clay-400 focus:outline-none focus:ring-2 focus:ring-sage-500/40 focus:border-sage-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveNotes}
              className="px-3 py-1 text-sm rounded-lg bg-sage-600 hover:bg-sage-700 text-white transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowNotesInput(false);
                setStageNotes(record?.notes || "");
              }}
              className="px-3 py-1 text-sm rounded-lg border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen viewer — tap any thumbnail to open. Prev/next wrap so
          the gesture stays consistent with the other lightbox call sites
          (Glaze, Combination). The lightbox owns the destructive delete
          action with a two-tap confirm; after deletion we re-anchor the
          viewer index in handleDeletePhoto. */}
      {record && record.photos.length > 0 && (
        <ImageLightbox
          isOpen={viewerIndex !== null}
          src={viewerIndex !== null ? record.photos[viewerIndex] : null}
          alt={`${STAGE_LABELS[stage]} photo ${(viewerIndex ?? 0) + 1}`}
          onClose={() => setViewerIndex(null)}
          onPrev={
            record.photos.length > 1
              ? () =>
                  setViewerIndex((i) =>
                    i === null ? null : (i - 1 + record.photos.length) % record.photos.length,
                  )
              : undefined
          }
          onNext={
            record.photos.length > 1
              ? () =>
                  setViewerIndex((i) =>
                    i === null ? null : (i + 1) % record.photos.length,
                  )
              : undefined
          }
          onDelete={
            viewerIndex !== null
              ? () => handleDeletePhoto(record.photos[viewerIndex])
              : undefined
          }
          footer={
            record.photos.length > 1
              ? `${(viewerIndex ?? 0) + 1} / ${record.photos.length}`
              : null
          }
        />
      )}
    </div>
  );
}
