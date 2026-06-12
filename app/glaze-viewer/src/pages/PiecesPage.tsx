/**
 * Pieces Page
 * Lists the user's pottery pieces grouped by stage
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { createPiece, listPieces } from "../api/piecesApi";
import { PageLayout } from "../components/PageLayout";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { Alert } from "../components/Alert";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Camera, ChevronRight, Droplet, Flame, Plus, Pottery, Sparkles } from "../components/Icons";
import type { PotteryPiece, PieceStage } from "../types/models";
import { STAGE_LABELS, STAGE_BADGE_COLORS } from "../lib/pieceStages";

const STAGE_ORDER: PieceStage[] = ["greenware", "bisqueware", "fired"];

function StageIcon({ stage }: { stage: PieceStage }) {
  if (stage === "greenware") {
    return <Droplet />;
  }
  if (stage === "bisqueware") {
    return <Flame />;
  }
  // Fired: sparkles for the glazed, finished surface.
  return <Sparkles />;
}

export function PiecesPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pieces, setPieces] = useState<PotteryPiece[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewPieceModal, setShowNewPieceModal] = useState(
    () => (location.state as { openNewPieceModal?: boolean } | null)?.openNewPieceModal === true
  );
  const [newPieceName, setNewPieceName] = useState("");
  const [newPieceClayBody, setNewPieceClayBody] = useState("");
  const [newPieceWeight, setNewPieceWeight] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const loadPieces = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await listPieces(user.uid);
      setPieces(data);
    } catch (err) {
      console.error("Failed to load pieces:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  useEffect(() => {
    if ((location.state as { openNewPieceModal?: boolean } | null)?.openNewPieceModal) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const handleCreatePiece = async () => {
    if (!newPieceName.trim() || isCreating || !user) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const piece = await createPiece({
        name: newPieceName.trim(),
        clayBody: newPieceClayBody.trim() || null,
        weight: newPieceWeight.trim() || null,
      });
      setShowNewPieceModal(false);
      setNewPieceName("");
      setNewPieceClayBody("");
      setNewPieceWeight("");
      navigate(`/pieces/${piece.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create piece");
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <PageLayout maxWidth="7xl" padY="8">
        <Spinner size="md" />
      </PageLayout>
    );
  }

  const activePieces = pieces.filter((p) => !p.isArchived);
  const archivedPieces = pieces.filter((p) => p.isArchived);

  // Group active pieces by currentStage
  const grouped: Record<PieceStage, PotteryPiece[]> = {
    greenware: [],
    bisqueware: [],
    fired: [],
  };
  for (const piece of activePieces) {
    grouped[piece.currentStage].push(piece);
  }

  const stagesWithPieces = STAGE_ORDER.filter((s) => grouped[s].length > 0);
  const isEmpty = activePieces.length === 0;

  return (
    <PageLayout maxWidth="7xl" padY="8">
      {/* Header. Compact "+" icon button on the right keeps the header on
          one row at every viewport width, mirroring the profile sections. */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200">Pieces</h1>
          <p className="text-sm text-clay-500 dark:text-clay-400 mt-0.5">
            Track your pottery from clay to kiln
          </p>
        </div>
        {/* Header action hidden when empty — the empty-state still owns
            the discovery CTA (Log your first piece). */}
        {!isEmpty && (
          <button
            onClick={() => setShowNewPieceModal(true)}
            aria-label="New piece"
            title="New piece"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white transition-colors"
          >
            <Plus />
          </button>
        )}
      </div>

      {/* Empty state. `variant="bare"` so it doesn't render as a separate
          floating card — the page already provides the surface. */}
      {isEmpty && (
        <EmptyState
          variant="bare"
          icon={<Pottery size="2xl" strokeWidth={1.5} />}
          title="No pieces yet"
          description="Log your first piece to track it through greenware, bisqueware, and the final firing."
          action={
            <button
              onClick={() => setShowNewPieceModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white font-medium transition-colors border border-terracotta-700"
            >
              <Plus />
              Log your first piece
            </button>
          }
        />
      )}

      {/* Pieces grouped by stage */}
      {!isEmpty && (
        <div className="space-y-6">
          {stagesWithPieces.map((stage) => (
            <section key={stage}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-clay-500 dark:text-clay-400">
                  <StageIcon stage={stage} />
                </span>
                <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200">
                  {STAGE_LABELS[stage]}
                </h2>
                <span className="text-sm text-clay-400 dark:text-earth-500">
                  {grouped[stage].length}
                </span>
              </div>
              {/* 2 cols on mobile portrait, 4 on landscape phones (xsl),
                  3 on tablet, 4 on laptop, 5 on desktop. Cards stay
                  content-dense rather than turning into giant blocks
                  once the page max-width opens up on wider screens. */}
              <div className="grid grid-cols-2 xsl:grid-cols-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {grouped[stage].map((piece) => (
                  // Stage badge is hidden when the grid is grouped by stage —
                  // the section heading already says "Greenware" / "Fired".
                  <PieceCard key={piece.id} piece={piece} hideStage />
                ))}
              </div>
            </section>
          ))}

          {/* Empty stages — show if all stages are empty but pieces exist (edge case handled above) */}
          {stagesWithPieces.length === 0 && (
            <p className="text-clay-500 dark:text-clay-400 text-center py-8">
              No active pieces
            </p>
          )}
        </div>
      )}

      {/* Archived section */}
      {archivedPieces.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-sm text-clay-500 dark:text-clay-400 hover:text-clay-700 dark:hover:text-clay-300 transition-colors mb-3"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${showArchived ? "rotate-90" : ""}`}
            />
            Archived ({archivedPieces.length})
          </button>

          {showArchived && (
            <div className="grid grid-cols-2 xsl:grid-cols-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {archivedPieces.map((piece) => (
                <PieceCard key={piece.id} piece={piece} archived />
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Piece Modal */}
      <Modal
        isOpen={showNewPieceModal}
        onClose={() => {
          setShowNewPieceModal(false);
          setNewPieceName("");
          setNewPieceClayBody("");
          setNewPieceWeight("");
          setCreateError(null);
        }}
        title="New Piece"
        footer={
          <>
            <button
              onClick={() => {
                setShowNewPieceModal(false);
                setNewPieceName("");
                setNewPieceClayBody("");
                setNewPieceWeight("");
                setCreateError(null);
              }}
              className="px-4 py-2 rounded-lg border-2 border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-300 font-medium hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePiece}
              disabled={!newPieceName.trim() || isCreating}
              className="px-4 py-2 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white font-medium transition-colors border border-terracotta-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </>
        }
      >
        {createError && (
          <Alert className="mb-4">{createError}</Alert>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1">
              Name *
            </label>
            <Input
              tone="terracotta"
              inputSize="sm"
              value={newPieceName}
              onChange={(e) => setNewPieceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePiece()}
              placeholder="e.g. Tall mug, Small bowl"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1">
              Clay body <span className="text-clay-400 font-normal">(optional)</span>
            </label>
            <Input
              tone="terracotta"
              inputSize="sm"
              value={newPieceClayBody}
              onChange={(e) => setNewPieceClayBody(e.target.value)}
              placeholder="e.g. Stoneware, Porcelain"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1">
              Weight <span className="text-clay-400 font-normal">(grams/ounces, optional)</span>
            </label>
            <Input
              tone="terracotta"
              inputSize="sm"
              value={newPieceWeight}
              onChange={(e) => setNewPieceWeight(e.target.value)}
              placeholder="e.g. 250g or 8 oz"
            />
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}

function PieceCard({
  piece,
  archived,
  hideStage,
}: {
  piece: PotteryPiece;
  archived?: boolean;
  /** Set to true when the parent grid groups by stage — prevents the
      floating stage badge from duplicating the section heading. */
  hideStage?: boolean;
}) {
  // Get the most recent photo from any stage
  const latestPhoto = piece.stageRecords
    .flatMap((r) => r.photos)
    .slice(-1)[0];

  const glazeCount = piece.glazes.length;

  return (
    <Link
      to={`/pieces/${piece.id}`}
      className={`group block rounded-xl overflow-hidden border-2 transition-all bg-white dark:bg-earth-800 ${
        archived
          ? "border-clay-200 dark:border-earth-700 opacity-60 hover:opacity-100"
          : "border-clay-200 dark:border-earth-600 hover:border-terracotta-300 dark:hover:border-terracotta-600"
      }`}
    >
      {/* Photo. Stays square so the card stays compact in a 2-col mobile
          grid; the name + meta sit on a solid strip below where they can
          wrap freely without fighting a busy photo background. */}
      <div className="relative aspect-square bg-clay-100 dark:bg-earth-700">
        {latestPhoto ? (
          <img
            src={latestPhoto}
            alt={piece.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera
              className="w-12 h-12 text-clay-300 dark:text-earth-600"
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Stage badge — floats top-right. Hidden when the parent grid
            groups by stage (the section heading owns that info) or when
            the piece is archived (the archived tint conveys state). */}
        {!archived && !hideStage && (
          <span
            className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium shadow-sm ${STAGE_BADGE_COLORS[piece.currentStage]}`}
          >
            {STAGE_LABELS[piece.currentStage]}
          </span>
        )}
        {archived && (
          <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium bg-clay-900/70 text-white">
            Archived
          </span>
        )}
      </div>

      {/* Name + meta strip. Solid background, name wraps to two lines, each
          piece of meta gets its own line so they read cleanly even when both
          are present. */}
      <div className="p-3">
        <p className="font-semibold text-clay-800 dark:text-clay-100 text-sm leading-snug line-clamp-2 group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400">
          {piece.name}
        </p>
        {piece.clayBody && (
          <p className="text-xs text-clay-500 dark:text-clay-400 mt-1 line-clamp-1">
            {piece.clayBody}
          </p>
        )}
        {piece.weight != null && piece.weight !== "" && (
          <p className="text-xs text-clay-500 dark:text-clay-400 mt-0.5">
            {piece.weight}
          </p>
        )}
        {glazeCount > 0 && (
          <p className="text-xs text-clay-500 dark:text-clay-400 mt-0.5">
            {glazeCount} glaze{glazeCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
