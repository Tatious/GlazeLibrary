/**
 * Piece Detail Page
 * Shows a single pottery piece with stage timeline, glaze plan, and inspo.
 */

import { useState, useEffect, useCallback, useRef, type RefObject } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, useDragControls, type PanInfo } from "framer-motion";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { useGlazes, useCombinations } from "../hooks/useGlazeData";
import { getPrimaryImage, prefixCdnUrl } from "../utils/glazeUtils";
import {
  getCollections,
  updateCollection,
} from "../api/collectionsApi";
import {
  deletePiece,
  getPiece,
  updatePiece,
} from "../api/piecesApi";
import { PageLayout } from "../components/PageLayout";
import { Spinner } from "../components/Spinner";
import { StagePhotoUpload } from "../components/piece/StagePhotoUpload";
import { GlazesSection } from "../components/piece/GlazesSection";
import { Input, Textarea } from "../components/Input";
import {
  Check,
  Close,
  Folder,
  GlazeSwatch,
  GripVertical,
  Layers,
  Pencil,
} from "../components/Icons";
import { STAGE_LABELS } from "../lib/pieceStages";
import type {
  PotteryPiece,
  PieceStage,
  PieceGlaze,
  CollectionItem,
  Collection,
} from "../types/models";

const STAGE_ORDER: PieceStage[] = ["greenware", "bisqueware", "fired"];

function stageIndex(stage: PieceStage) {
  return STAGE_ORDER.indexOf(stage);
}

// ============================================================================
// Glaze Inspo → Glaze Plan drag-and-drop
// ============================================================================

/** Which drop target the pointer is currently over during an inspo drag. */
type DropTarget = "plan" | "bar" | null;

function pointInEl(el: HTMLElement | null, x: number, y: number): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/**
 * Suppress text selection (and the iOS long-press callout) on the whole page
 * while a touch drag is in flight. framer-motion applies this to the dragged
 * element itself — but only when `dragListener !== false`. We opt out of that
 * (so the tile body still scrolls under touch) and start drags from a handle,
 * so without this a touch-drag would rubber-band a text selection instead.
 */
function suppressBodySelection(on: boolean) {
  if (typeof document === "undefined") return;
  const s = document.body.style;
  if (on) {
    s.userSelect = "none";
    s.setProperty("-webkit-user-select", "none");
  } else {
    s.userSelect = "";
    s.removeProperty("-webkit-user-select");
  }
}

interface InspoCardProps {
  item: CollectionItem;
  label: string;
  href: string;
  thumbSrc: string | null;
  isGlaze: boolean;
  planCardRef: RefObject<HTMLDivElement | null>;
  dropBarRef: RefObject<HTMLDivElement | null>;
  onDragActiveChange: (active: boolean) => void;
  onHoverTargetChange: (target: DropTarget) => void;
  onDropToPlan: (item: CollectionItem) => void;
  onRemove: (item: CollectionItem) => void;
}

/**
 * A single Glaze Inspo tile. Draggable (via its grip handle) onto the Glaze
 * Plan card or the floating drop bar. Uses framer-motion pointer dragging so
 * it works on touch (iOS) where native HTML5 drag-and-drop does not. Only the
 * grip captures the pointer, so the rest of the tile still taps/scrolls.
 */
function InspoCard({
  item,
  label,
  href,
  thumbSrc,
  isGlaze,
  planCardRef,
  dropBarRef,
  onDragActiveChange,
  onHoverTargetChange,
  onDropToPlan,
  onRemove,
}: InspoCardProps) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  const targetAt = (info: PanInfo): DropTarget => {
    // framer-motion reports `info.point` in *page* coordinates (scroll
    // included), but `getBoundingClientRect()` is viewport-relative — convert
    // to viewport space so the hit-test is correct at any scroll position.
    const x = info.point.x - window.scrollX;
    const y = info.point.y - window.scrollY;
    if (pointInEl(planCardRef.current, x, y)) return "plan";
    if (pointInEl(dropBarRef.current, x, y)) return "bar";
    return null;
  };

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0.12}
      onDragStart={() => {
        setIsDragging(true);
        onDragActiveChange(true);
        suppressBodySelection(true);
      }}
      onDrag={(_, info) => onHoverTargetChange(targetAt(info))}
      onDragEnd={(_, info) => {
        const target = targetAt(info);
        setIsDragging(false);
        onDragActiveChange(false);
        onHoverTargetChange(null);
        suppressBodySelection(false);
        if (target) onDropToPlan(item);
      }}
      whileDrag={{ scale: 1.06, zIndex: 50 }}
      className={`group relative select-none [-webkit-touch-callout:none] rounded-xl border overflow-hidden transition-colors ${
        isDragging
          ? "border-terracotta-400 dark:border-terracotta-500 shadow-2xl"
          : "border-clay-200 dark:border-earth-600 hover:border-terracotta-300 dark:hover:border-terracotta-600"
      }`}
    >
      {/* Drag handle — only this element starts a drag, so the rest of the
          tile still taps (navigate) and the page still scrolls under touch. */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          dragControls.start(e);
        }}
        style={{
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
        className="absolute top-1.5 left-1.5 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-earth-900/85 text-clay-600 dark:text-clay-300 shadow-md backdrop-blur-sm cursor-grab active:cursor-grabbing touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500"
        title="Drag into your glaze plan"
        aria-label={`Drag ${label} into your glaze plan`}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <Link to={href} className="block" draggable={false}>
        <div className="aspect-square bg-clay-100 dark:bg-earth-700">
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center ${
                isGlaze
                  ? "bg-sage-50 dark:bg-sage-900/20"
                  : "bg-butter-50 dark:bg-butter-900/20"
              }`}
            >
              {isGlaze ? (
                <GlazeSwatch className="w-8 h-8 text-sage-400" strokeWidth={1.5} />
              ) : (
                <Layers className="w-8 h-8 text-butter-500" strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-clay-800 dark:text-clay-200 group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400">
            {label}
          </p>
        </div>
      </Link>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(item);
        }}
        className="absolute top-1.5 right-1.5 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-earth-900/85 text-clay-700 dark:text-clay-200 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white shadow-md backdrop-blur-sm transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        title="Remove inspiration"
        aria-label="Remove inspiration"
      >
        <Close strokeWidth={2.5} />
      </button>
    </motion.div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function PieceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const [piece, setPiece] = useState<PotteryPiece | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClayBody, setEditClayBody] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [showImportCollection, setShowImportCollection] = useState(false);
  const [importProjects, setImportProjects] = useState<Collection[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag-and-drop: dragging a Glaze Inspo tile onto the Glaze Plan (or the
  // floating drop bar) adds it as a plan row. `planCardRef` is attached to the
  // plan panel so a dragged tile can hit-test against it.
  const planCardRef = useRef<HTMLDivElement>(null);
  const dropBarRef = useRef<HTMLDivElement>(null);
  const [inspoDragActive, setInspoDragActive] = useState(false);
  const [inspoDropTarget, setInspoDropTarget] = useState<DropTarget>(null);

  const loadPiece = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const p = await getPiece(id);
      setPiece(p);
      setEditName(p.name);
      setEditClayBody(p.clayBody || "");
      setEditWeight(p.weight || "");
      setEditNotes(p.notes || "");
    } catch (err: unknown) {
      // 404 — piece missing or deleted; bail back to the list.
      const message = err instanceof Error ? err.message : "";
      if (message.includes("404")) {
        navigate("/pieces");
      } else {
        console.error("Failed to load piece:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPiece();
  }, [loadPiece]);

  const handleSaveEdit = async () => {
    if (!piece || !user) return;
    setIsSaving(true);
    try {
      const updated = await updatePiece(piece.id, {
        name: editName.trim(),
        clayBody: editClayBody.trim() || null,
        weight: editWeight.trim() || null,
        notes: editNotes.trim() || null,
      });
      setPiece(updated);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (archive: boolean) => {
    if (!piece || !user) return;
    try {
      const updated = await updatePiece(piece.id, {
        isArchived: archive,
      });
      setPiece(updated);
    } catch (err) {
      console.error("Failed to archive:", err);
    }
  };

  const handleDelete = async () => {
    if (!piece || !user) return;
    setIsDeleting(true);
    try {
      await deletePiece(piece.id);
      navigate("/pieces");
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAdvanceStage = async (stage: PieceStage) => {
    if (!piece || !user) return;
    const existingRecord = piece.stageRecords.find((r) => r.stage === stage);
    const updatedRecords = existingRecord
      ? piece.stageRecords
      : [...piece.stageRecords, { stage, date: new Date().toISOString(), photos: [], notes: null }];
    try {
      const updated = await updatePiece(piece.id, {
        currentStage: stage,
        stageRecords: updatedRecords,
      });
      setPiece(updated);
    } catch (err) {
      console.error("Failed to advance stage:", err);
    }
  };

  // Glaze inspo helpers. Source of truth is the piece's attached inspo
  // collection; `piece.inspoLikes` on the response is a denormalized mirror,
  // refreshed by refetching the piece after any write.
  const { data: glazeList = [] } = useGlazes();
  const { data: comboList = [] } = useCombinations();
  const glazeMap = Object.fromEntries(glazeList.map((g) => [g.id, g]));
  const comboMap = Object.fromEntries(comboList.map((c) => [c.id, c]));

  const handleRemoveInspo = async (item: CollectionItem) => {
    if (!piece || !user || !piece.inspoCollectionId) return;
    try {
      const next = (piece.inspoLikes || []).filter(
        (i) => !(i.type === item.type && i.id === item.id),
      );
      await updateCollection(
        piece.inspoCollectionId,
        { likes: next },
        user.uid,
      );
      // Refetch so `piece.inspoLikes` (denorm'd on the server) is in sync.
      const refreshed = await getPiece(piece.id);
      setPiece(refreshed);
    } catch (err) {
      console.error("Failed to remove inspo:", err);
    }
  };

  // Turn a dragged inspo item into a Glaze Plan row and append it. A glaze
  // becomes a single-glaze row; a combination becomes a layered row (base =
  // bottom glaze, over = top glaze, mirroring the publish link's params).
  const handleAddInspoToPlan = useCallback(
    async (item: CollectionItem) => {
      if (!piece || !user) return;
      let entry: PieceGlaze;
      if (item.type === "glaze") {
        if (!glazeMap[item.id]) return;
        entry = { glazeId: item.id, coats: 2 };
      } else {
        const combo = comboMap[item.id];
        if (!combo) return;
        entry = {
          glazeId: combo.bottomGlaze.glazeId,
          coats: 2,
          overGlazeId: combo.topGlaze.glazeId,
          overCoats: 2,
        };
      }
      // Skip if an identical row is already planned.
      const dup = piece.glazes.some(
        (g) =>
          g.glazeId === entry.glazeId &&
          (g.overGlazeId ?? "") === (entry.overGlazeId ?? ""),
      );
      if (dup) return;
      try {
        const updated = await updatePiece(piece.id, {
          glazes: [...piece.glazes, entry],
        });
        setPiece(updated);
      } catch (err) {
        console.error("Failed to add inspo to plan:", err);
      }
    },
    [piece, user, glazeMap, comboMap],
  );

  const handleOpenImportCollection = async () => {
    setShowImportCollection(true);
    setIsLoadingProjects(true);
    try {
      const data = await getCollections(user?.uid);
      setImportProjects(data);
    } catch (err) {
      console.error("[ImportCollection] failed to load projects:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleImportCollection = async (projectId: string) => {
    if (!piece || !user || !piece.inspoCollectionId) return;
    const project = importProjects.find((p) => p.id === projectId);
    if (!project) return;
    const current = piece.inspoLikes || [];
    const existingKeys = new Set(current.map((i) => `${i.type}:${i.id}`));
    const toAdd: CollectionItem[] = project.likes
      .filter((l) => !existingKeys.has(`${l.type}:${l.id}`))
      .map((l) => ({
        type: l.type,
        id: l.id,
        likedAt: new Date().toISOString(),
      }));
    if (toAdd.length === 0) {
      setShowImportCollection(false);
      return;
    }
    try {
      await updateCollection(
        piece.inspoCollectionId,
        { likes: [...current, ...toAdd] },
        user.uid,
      );
      const refreshed = await getPiece(piece.id);
      setPiece(refreshed);
    } catch (err) {
      console.error("[ImportCollection] error:", err);
    }
    setShowImportCollection(false);
  };

  if (authLoading || isLoading) {
    return (
      <PageLayout maxWidth="7xl" padY="8">
        <Spinner size="md" />
      </PageLayout>
    );
  }

  if (!piece) return null;

  const isOwner = user?.uid === piece.userId;

  return (
    <PageLayout maxWidth="7xl" padY="8">
      {/* Breadcrumb — same pattern as CollectionDetail so the two
          container-detail pages feel like siblings. */}
      <div className="flex items-center gap-2 text-sm mb-3">
        <Link
          to="/pieces"
          className="text-clay-500 dark:text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
        >
          Pieces
        </Link>
        <span className="text-clay-400 dark:text-clay-500">›</span>
        <span className="text-clay-600 dark:text-clay-300 truncate">
          {piece.name}
        </span>
      </div>

      {!isEditing ? (
        <>
          {/* Page-flush header — matches the other detail pages (Glaze,
              Combination, Settings) so the header system is uniform.
              Switches to an inline edit card below when the user taps the
              pencil. */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200">
                  {piece.name}
                </h1>
                {piece.isArchived && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-clay-100 dark:bg-earth-700 text-clay-500 dark:text-clay-400">
                    Archived
                  </span>
                )}
              </div>
              {/* Subtitle: clay body · created date · weight. All optional
                  pieces of metadata go on the same line joined with a
                  middle dot so the layout doesn't shift when any one
                  is missing. */}
              <p className="text-sm text-clay-500 dark:text-clay-400">
                {[
                  piece.clayBody,
                  `Started ${new Date(piece.createdAt).toLocaleDateString()}`,
                  piece.weight,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {piece.notes && (
                <p className="mt-2 text-sm text-clay-600 dark:text-clay-300">{piece.notes}</p>
              )}
            </div>
            {isOwner && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-lg text-clay-500 hover:text-clay-700 dark:hover:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-700 transition-colors"
                  title="Edit details"
                  aria-label="Edit details"
                >
                  <Pencil />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Edit form — wrapped in a card because it's a focused edit
           surface, not a page header. */
        <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1">Name</label>
              <Input
                tone="terracotta"
                inputSize="sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1">
                Clay body <span className="font-normal text-clay-400">(optional)</span>
              </label>
              <Input
                tone="terracotta"
                inputSize="sm"
                value={editClayBody}
                onChange={(e) => setEditClayBody(e.target.value)}
                placeholder="e.g. Stoneware"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1">
                Weight <span className="font-normal text-clay-400">(grams/ounces, optional)</span>
              </label>
              <Input
                tone="terracotta"
                inputSize="sm"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                placeholder="e.g. 250g or 8 oz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1">
                Notes <span className="font-normal text-clay-400">(optional)</span>
              </label>
              <Textarea
                tone="terracotta"
                inputSize="sm"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-300 font-medium hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editName.trim() || isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white font-medium transition-colors border border-terracotta-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Timeline */}
      <div className="bg-white dark:bg-earth-800 rounded-xl p-4 sm:p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600 mb-6">
        <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-4">Progress</h2>

        {/* Stage steps */}
        <div className="space-y-0">
          {STAGE_ORDER.map((stage, idx) => {
            const currentIdx = stageIndex(piece.currentStage);
            // A stage is "done" if a later stage is the current one, OR
            // if this stage IS the current one and it's the terminal
            // stage (`fired`). Without the second clause, a piece at
            // the last stage would sit forever as "isCurrent" (hollow
            // dot with the numeral) since there's nothing past it to
            // bump `currentIdx` higher. We treat reaching the final
            // stage as completing the timeline.
            const isTerminal = idx === STAGE_ORDER.length - 1;
            const isDone =
              currentIdx > idx || (isTerminal && currentIdx === idx);
            const isCurrent = piece.currentStage === stage && !isDone;
            const isNext = idx === currentIdx + 1;
            const isFarFuture = idx > currentIdx + 1;
            const record = piece.stageRecords.find((r) => r.stage === stage);

            return (
              <div key={stage} className="relative">
                {/* Connector line — dynamic height so it actually reaches the
                    next dot regardless of how tall this stage's content is. */}
                {idx < STAGE_ORDER.length - 1 && (
                  <div
                    className={`absolute left-2.5 top-6 bottom-1 w-0.5 ${
                      isDone ? "bg-terracotta-400 dark:bg-terracotta-500" : "bg-clay-200 dark:bg-earth-600"
                    }`}
                  />
                )}

                <div className={`flex gap-3 pb-5 ${idx === STAGE_ORDER.length - 1 ? "pb-0" : ""}`}>
                  {/* Stage dot */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isDone
                        ? "bg-terracotta-500 text-white"
                        : isCurrent
                        ? "bg-terracotta-100 dark:bg-terracotta-900/40 border-2 border-terracotta-500 text-terracotta-600 dark:text-terracotta-300"
                        : isNext
                        ? "bg-clay-100 dark:bg-earth-700 border-2 border-clay-400 dark:border-earth-500 text-clay-500 dark:text-earth-400"
                        : "bg-clay-100 dark:bg-earth-700 border-2 border-clay-300 dark:border-earth-600 text-clay-400 dark:text-earth-500"
                    }`}
                  >
                    {isDone ? (
                      <Check size="xs" strokeWidth={3} />
                    ) : (
                      <span className="text-[10px] font-bold leading-none">{idx + 1}</span>
                    )}
                  </div>

                  {/* Stage content */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h3 className={`font-semibold ${isFarFuture ? "text-clay-400 dark:text-earth-500" : "text-clay-800 dark:text-clay-200"}`}>
                          {STAGE_LABELS[stage]}
                        </h3>
                        {isCurrent && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300 font-medium">
                            Current
                          </span>
                        )}
                      </div>
                      {record?.date && (
                        <p className="text-xs text-clay-400 dark:text-earth-500 mt-0.5">
                          {new Date(record.date).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Stage actions for owner */}
                    {isOwner && (isDone || isCurrent) && (
                      <StagePhotoUpload
                        piece={piece}
                        stage={stage}
                        onUploaded={setPiece}
                      />
                    )}

                    {/* Advance to next stage */}
                    {isOwner && isNext && (
                      <button
                        onClick={() => handleAdvanceStage(stage)}
                        className="mt-1 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-terracotta-50 dark:bg-terracotta-900/20 border border-terracotta-300 dark:border-terracotta-700 text-terracotta-700 dark:text-terracotta-300 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/40 transition-colors font-medium"
                      >
                        Advance to {STAGE_LABELS[stage]} →
                      </button>
                    )}


                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Glazes section */}
      {isOwner && (
        <div className="mb-6">
          <GlazesSection
            piece={piece}
            onUpdated={setPiece}
            cardRef={planCardRef}
            dragActive={inspoDragActive}
            dropActive={inspoDropTarget === "plan"}
          />
        </div>
      )}

      {/* Glaze Inspo section */}
      {isOwner && (
        <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600 mb-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200">Glaze Inspo</h2>
              <p className="text-xs text-clay-400 dark:text-clay-500 mt-0.5">Save glazes &amp; combos to consider — drag one onto your plan to use it</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleOpenImportCollection}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors whitespace-nowrap"
              >
                <Folder size="sm" />
                <span className="hidden xs:inline xsl:inline">Import collection</span>
                <span className="xs:hidden xsl:hidden">Import</span>
              </button>
            </div>
          </div>

          {/* Import collection picker */}
          {showImportCollection && (
            <div className="mb-4 p-3 rounded-lg bg-clay-50 dark:bg-earth-750 border border-clay-200 dark:border-earth-600">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-clay-700 dark:text-clay-300">Pick a collection to import</span>
                <button
                  onClick={() => setShowImportCollection(false)}
                  className="text-clay-400 hover:text-clay-600 dark:hover:text-clay-300"
                >
                  <Close />
                </button>
              </div>
              {isLoadingProjects ? (
                <div className="flex justify-center py-3">
                  <Spinner size="sm" layout="inline" />
                </div>
              ) : importProjects.length === 0 ? (
                <p className="text-sm text-clay-500 dark:text-clay-400 text-center py-2">No collections yet</p>
              ) : (
                <ul className="space-y-1">
                  {importProjects.map((proj) => (
                    <li key={proj.id}>
                      <button
                        onClick={() => handleImportCollection(proj.id)}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-clay-100 dark:hover:bg-earth-700 text-clay-700 dark:text-clay-300 transition-colors flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{proj.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 shrink-0">
                          {proj.likes.length} item{proj.likes.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Inspo items. Filtered only to items that still exist in the
              catalog — unowned items stay visible so the user can shop for
              them or swap them in once acquired. */}
          {(() => {
            const visibleInspo = (piece.inspoLikes || []).filter((item) => {
              return item.type === "glaze"
                ? !!glazeMap[item.id]
                : !!comboMap[item.id];
            });
            if (visibleInspo.length === 0) return null;
            return (
              <div className="grid grid-cols-2 xsl:grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                {visibleInspo.map((item) => {
                  const isGlaze = item.type === "glaze";
                  const glaze = isGlaze ? glazeMap[item.id] : null;
                  const combo = !isGlaze ? comboMap[item.id] : null;
                  // Combos may not have a precomputed `displayName` — fall
                  // back to "Top over Bottom" to match what every other card
                  // in the app renders, instead of leaking the raw combo id.
                  const label = isGlaze
                    ? (glaze?.displayName ?? item.id)
                    : combo
                      ? (combo.displayName ??
                        `${combo.topGlaze.displayName} over ${combo.bottomGlaze.displayName}`)
                      : item.id;
                  const href = isGlaze ? `/glaze/${item.id}` : `/combination/${item.id}`;
                  const thumbSrc = isGlaze && glaze
                    ? (prefixCdnUrl(getPrimaryImage(glaze) ?? "") ?? null)
                    : combo?.entries?.[0]?.photos?.[0]?.url
                      ? (prefixCdnUrl(combo.entries[0].photos[0].url) ?? null)
                      : null;
                  return (
                    <InspoCard
                      key={`${item.type}:${item.id}`}
                      item={item}
                      label={label}
                      href={href}
                      thumbSrc={thumbSrc}
                      isGlaze={isGlaze}
                      planCardRef={planCardRef}
                      dropBarRef={dropBarRef}
                      onDragActiveChange={setInspoDragActive}
                      onHoverTargetChange={setInspoDropTarget}
                      onDropToPlan={handleAddInspoToPlan}
                      onRemove={handleRemoveInspo}
                    />
                  );
                })}
              </div>
            );
          })()}

          {/* Browse row — always rendered so the user can keep adding more
              even after they already have inspo items. The Glazes/Combos
              pills pre-pin this piece via `?addTo=piece:{id}` so the grid
              boots straight into select mode targeting this piece. The
              Discover button opens the swipe view directly on the piece's
              inspo collection so the deck inherits its `swipeProgress`. */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-clay-400 dark:text-clay-500">
              {(piece.inspoLikes || []).length === 0 ? "Browse:" : "Add more:"}
            </span>
            <Link to={`/glazes?addTo=piece:${piece.id}`} className="px-3 py-1 rounded-full text-sm font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/30 hover:text-terracotta-700 dark:hover:text-terracotta-400 transition-colors">Glazes</Link>
            <Link to={`/combinations?addTo=piece:${piece.id}`} className="px-3 py-1 rounded-full text-sm font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/30 hover:text-terracotta-700 dark:hover:text-terracotta-400 transition-colors">Combos</Link>
            {piece.inspoCollectionId && (
              <Link
                to={`/discover/use?edit=${piece.inspoCollectionId}&returnTo=${encodeURIComponent(`/pieces/${piece.id}`)}`}
                className="px-3 py-1 rounded-full text-sm font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/30 hover:text-terracotta-700 dark:hover:text-terracotta-400 transition-colors"
              >
                Discover
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Actions (owner only) */}
      {isOwner && (
        <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
          <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-4">Actions</h2>

          {!piece.isArchived ? (
            /* Active piece: archive only */
            <button
              onClick={() => handleArchive(true)}
              className="px-4 py-2 text-sm rounded-lg border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
            >
              Archive piece
            </button>
          ) : (
            /* Archived piece: unarchive or delete */
            <div className="space-y-3">
              <p className="text-sm text-clay-500 dark:text-clay-400">
                This piece is archived. Unarchive to move it back to your active list, or delete it permanently.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleArchive(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
                >
                  Unarchive piece
                </button>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete permanently
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-clay-700 dark:text-clay-300">Delete permanently?</span>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating drop target — shown only while dragging an inspo tile, so the
          Glaze Plan is reachable even when scrolled out of view. Fixed to the
          bottom to stay clear of the top nav. */}
      {isOwner && inspoDragActive && (
        <div
          ref={dropBarRef}
          className={`fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 px-4 pt-3 text-sm font-semibold border-t-2 transition-colors ${
            inspoDropTarget === "bar"
              ? "bg-terracotta-500 text-white border-terracotta-600"
              : "bg-white/95 dark:bg-earth-800/95 text-terracotta-700 dark:text-terracotta-300 border-terracotta-300 dark:border-terracotta-700 backdrop-blur-sm"
          }`}
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <GripVertical className="w-4 h-4" />
          Drop here to add to your glaze plan
        </div>
      )}
    </PageLayout>
  );
}

// Build upload URL pre-filled from piece glazes

