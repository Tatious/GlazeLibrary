/**
 * BatchAddBar — sticky bottom bar that appears when the user is in
 * grid-selection mode on a list page (Glazes, Combinations).
 *
 * Two visual modes:
 *
 * - **Free-form**: the user entered select mode manually. Bar shows the
 *   selection count and two trigger buttons: "Add to piece" / "Add to
 *   collection", each opening a small popover with a searchable list of
 *   targets.
 *
 * - **Pinned**: the user landed here from a piece/collection detail page
 *   via `?addTo=piece:{id}`. Bar shows the target's name and a single
 *   "Add N to {name}" button — no picker needed.
 *
 * After a successful add: toast for ~1.5s, then clear the selection. If
 * pinned, also navigate back to the detail page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createCollection, getCollections, updateCollection } from "../api/collectionsApi";
import { createPiece, getPiece, listPieces } from "../api/piecesApi";
import { PickerRow } from "./PickerRow";
import { PickerSurface } from "./PickerSurface";
import { Spinner } from "./Spinner";
import { STAGE_BADGE_COLORS, STAGE_LABELS } from "../lib/pieceStages";
import type {
  Collection,
  CollectionItem,
  PotteryPiece,
} from "../types/models";
import type { PinnedTarget, SelectionStore } from "../hooks/useBatchSelect";
import { useSelectedItems } from "../hooks/useBatchSelect";
import { Close, Plus } from "./Icons";

type ItemType = "glaze" | "combination";

/** A single selected item, derived from a canonical `${type}:${id}` key. */
export interface SelectedItem {
  type: ItemType;
  id: string;
}

export interface BatchAddBarProps {
  /** Selection store (ref-stable). The bar subscribes internally so it
   *  re-renders on every selection change without re-rendering the parent
   *  page's grid of cards. */
  store: SelectionStore;
  /** Which kind of items this bar is operating on. */
  itemType: ItemType;
  /** Pinned target from the URL, if any (single-button mode). */
  pinned: PinnedTarget | null;
  /** Cancel button — clear selection and exit select mode. */
  onCancel: () => void;
  /** After a successful add, called to clear the selection but stay in mode. */
  onAdded: () => void;
  /** Called when the pinned target is consumed (drops `addTo` from URL). */
  onClearPinned: () => void;
}

export function BatchAddBar({
  store,
  itemType,
  pinned,
  onCancel,
  onAdded,
  onClearPinned,
}: BatchAddBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [picker, setPicker] = useState<"piece" | "collection" | null>(null);
  const [pieces, setPieces] = useState<PotteryPiece[] | null>(null);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Inline "+ New {kind}" UX: when the user clicks the footer in either
  // picker, we swap that footer for a name input + Create button. State is
  // shared across pickers (only one is ever open) and reset every time the
  // popover opens/closes.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  // Per-trigger refs so the PickerSurface can anchor (desktop) under the
  // exact button that opened it. On mobile the surface collapses to a
  // bottom sheet and the ref is ignored.
  const pieceTriggerRef = useRef<HTMLButtonElement>(null);
  const collectionTriggerRef = useRef<HTMLButtonElement>(null);

  // Live selection — subscribing here (not in the page) keeps the page's
  // grid of cards out of the re-render path on every toggle.
  const items = useSelectedItems(store, itemType);
  const count = items.length;

  // Reset the inline-create UI whenever the picker opens/closes or swaps
  // between piece/collection — nothing more annoying than a stale draft.
  useEffect(() => {
    setCreating(false);
    setNewName("");
  }, [picker]);

  // Lazy-load targets when a picker opens.
  useEffect(() => {
    if (!picker || !user?.uid) return;
    setLoading(true);
    (async () => {
      try {
        if (picker === "piece" && pieces === null) {
          const all = await listPieces(user.uid);
          setPieces(all.filter((p) => !p.isArchived));
        }
        if (picker === "collection" && collections === null) {
          setCollections(await getCollections(user.uid));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [picker, user?.uid, pieces, collections]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
  }, []);

  // Merge `items` into a piece's inspo collection (dedup, preserve order).
  // The piece's `inspoCollectionId` is the source of truth; the piece's
  // `inspoLikes` field is a denormalized read-only mirror, so we refetch
  // after the write to keep callers (and the picker) consistent.
  const addToPiece = useCallback(
    async (pieceId: string, pieceName: string) => {
      if (!user || busy || count === 0) return;
      setBusy(true);
      try {
        const piece = await getPiece(pieceId);
        const inspoId = piece.inspoCollectionId;
        if (!inspoId) {
          // Should never happen post-backfill, but bail rather than silently
          // dropping the add.
          throw new Error(`Piece ${pieceId} has no inspo collection`);
        }
        const current = piece.inspoLikes ?? [];
        const existing = new Set(current.map((i) => `${i.type}:${i.id}`));
        const toAdd: CollectionItem[] = items
          .filter((it) => !existing.has(`${it.type}:${it.id}`))
          .map((it) => ({
            type: it.type,
            id: it.id,
            likedAt: new Date().toISOString(),
          }));
        if (toAdd.length > 0) {
          await updateCollection(
            inspoId,
            { likes: [...current, ...toAdd] },
            user.uid,
          );
        }
        const skipped = count - toAdd.length;
        showToast(
          toAdd.length === 0
            ? `Already in ${pieceName}`
            : skipped > 0
              ? `Added ${toAdd.length} to ${pieceName} (${skipped} already there)`
              : `Added ${toAdd.length} to ${pieceName}`,
        );
        // Drop the cached piece list so the next picker open reflects the
        // updated inspo counts (the picker reads `piece.inspoLikes`).
        setPieces(null);
        setPicker(null);
        onAdded();
        if (pinned?.kind === "piece" && pinned.id === pieceId) {
          onClearPinned();
          // Bounce back so the user sees the inspo they just added.
          navigate(`/pieces/${pieceId}`);
        }
      } catch (err) {
        console.error("Batch add to piece failed:", err);
        showToast("Failed — try again");
      } finally {
        setBusy(false);
      }
    },
    [busy, count, items, user, pinned, onAdded, onClearPinned, navigate, showToast],
  );

  // Merge `items` into a collection's likes (dedup).
  const addToCollection = useCallback(
    async (collectionId: string, collectionName: string) => {
      if (!user || busy || count === 0) return;
      const target = collections?.find((c) => c.id === collectionId);
      if (!target) return;
      setBusy(true);
      try {
        const existing = new Set(target.likes.map((l) => `${l.type}:${l.id}`));
        const toAdd: CollectionItem[] = items
          .filter((it) => !existing.has(`${it.type}:${it.id}`))
          .map((it) => ({
            type: it.type,
            id: it.id,
            likedAt: new Date().toISOString(),
          }));
        if (toAdd.length > 0) {
          await updateCollection(
            collectionId,
            { likes: [...target.likes, ...toAdd] },
            user.uid,
          );
          // Refresh the cached list so the next picker open shows the new counts.
          setCollections((prev) =>
            prev?.map((c) =>
              c.id === collectionId
                ? { ...c, likes: [...c.likes, ...toAdd] }
                : c,
            ) ?? null,
          );
        }
        const skipped = count - toAdd.length;
        showToast(
          toAdd.length === 0
            ? `Already in ${collectionName}`
            : skipped > 0
              ? `Added ${toAdd.length} to ${collectionName} (${skipped} already there)`
              : `Added ${toAdd.length} to ${collectionName}`,
        );
        setPicker(null);
        onAdded();
        if (pinned?.kind === "collection" && pinned.id === collectionId) {
          onClearPinned();
          navigate(`/collections/${collectionId}`);
        }
      } catch (err) {
        console.error("Batch add to collection failed:", err);
        showToast("Failed — try again");
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      count,
      items,
      user,
      collections,
      pinned,
      onAdded,
      onClearPinned,
      navigate,
      showToast,
    ],
  );

  // Create a brand-new piece with the selected items already attached as
  // inspo. Two round-trips: POST piece (server eagerly creates an empty
  // inspo collection), then PUT that collection's likes. Toast + close on
  // success. Failures roll back nothing because we never mutated local
  // state until the response arrived.
  const createPieceWithItems = useCallback(async () => {
    if (!user || busy || count === 0 || !newName.trim()) return;
    setBusy(true);
    try {
      const piece = await createPiece({ name: newName.trim() });
      const likes: CollectionItem[] = items.map((it) => ({
        type: it.type,
        id: it.id,
        likedAt: new Date().toISOString(),
      }));
      if (piece.inspoCollectionId) {
        await updateCollection(
          piece.inspoCollectionId,
          { likes },
          user.uid,
        );
      }
      // Bounce to the new piece — the destination is its own confirmation,
      // and the unmount cleans up select mode + the picker. Mirrors the
      // pinned-add path.
      onAdded();
      navigate(`/pieces/${piece.id}`);
    } catch (err) {
      console.error("Create piece + add failed:", err);
      showToast("Failed — try again");
      setBusy(false);
    }
  }, [user, busy, count, newName, items, onAdded, navigate, showToast]);

  // Create a brand-new collection with the selected items already in its
  // `likes`. Single POST (createCollection accepts a `likes` array).
  const createCollectionWithItems = useCallback(async () => {
    if (!user || busy || count === 0 || !newName.trim()) return;
    setBusy(true);
    try {
      const likes: CollectionItem[] = items.map((it) => ({
        type: it.type,
        id: it.id,
        likedAt: new Date().toISOString(),
      }));
      const created = await createCollection(
        newName.trim(),
        likes,
        undefined,
        user.uid,
      );
      // Bounce to the new collection — same reasoning as the piece path.
      onAdded();
      navigate(`/collections/${created.id}`);
    } catch (err) {
      console.error("Create collection + add failed:", err);
      showToast("Failed — try again");
      setBusy(false);
    }
  }, [user, busy, count, newName, items, onAdded, navigate, showToast]);

  // Resolve the pinned target's display name once it's been loaded.
  const pinnedName = useMemo(() => {
    if (!pinned) return null;
    if (pinned.kind === "piece") {
      return pieces?.find((p) => p.id === pinned.id)?.name ?? "piece";
    }
    return collections?.find((c) => c.id === pinned.id)?.name ?? "collection";
  }, [pinned, pieces, collections]);

  // Auto-load the pinned target's name on mount (so the button label reads
  // correctly before the user interacts with anything).
  useEffect(() => {
    if (!pinned || !user?.uid) return;
    (async () => {
      if (pinned.kind === "piece" && pieces === null) {
        const all = await listPieces(user.uid);
        setPieces(all.filter((p) => !p.isArchived));
      }
      if (pinned.kind === "collection" && collections === null) {
        setCollections(await getCollections(user.uid));
      }
    })();
  }, [pinned, user?.uid, pieces, collections]);

  const handlePinnedAdd = () => {
    if (!pinned) return;
    if (pinned.kind === "piece") {
      addToPiece(pinned.id, pinnedName ?? "piece");
    } else {
      addToCollection(pinned.id, pinnedName ?? "collection");
    }
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-clay-900 text-white text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      <div
        className="fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-earth-800/95 backdrop-blur-sm border-t border-clay-200 dark:border-earth-600 shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* Status row — count + cancel. Always visible so the user always
              knows they're in select mode and can leave it. */}
          <div className="flex items-center justify-between gap-3 sm:flex-1">
            <span className="text-sm font-medium text-clay-700 dark:text-clay-200">
              {count === 0
                ? "Tap items to select"
                : `${count} selected`}
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="sm:hidden px-3 py-1.5 rounded-lg text-sm font-medium text-clay-600 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Action row. Hidden when nothing is selected so the user isn't
              staring at greyed-out buttons the moment they enter select mode.
              Filled (not outlined) so the affordance reads as primary action,
              not as "disabled-ish". */}
          {count > 0 && (
            pinned ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePinnedAdd}
                  disabled={busy}
                  className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg bg-terracotta-500 text-white text-sm font-semibold hover:bg-terracotta-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {busy
                    ? "Adding…"
                    : `Add ${count} to ${pinnedName ?? pinned.kind}`}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm text-clay-600 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <button
                  ref={pieceTriggerRef}
                  type="button"
                  onClick={() =>
                    setPicker((p) => (p === "piece" ? null : "piece"))
                  }
                  disabled={busy}
                  className="px-3 py-2.5 sm:py-2 rounded-lg bg-terracotta-500 text-white text-sm font-semibold hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Add to piece
                </button>
                <button
                  ref={collectionTriggerRef}
                  type="button"
                  onClick={() =>
                    setPicker((p) =>
                      p === "collection" ? null : "collection",
                    )
                  }
                  disabled={busy}
                  className="px-3 py-2.5 sm:py-2 rounded-lg bg-sage-600 text-white text-sm font-semibold hover:bg-sage-700 active:bg-sage-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Add to collection
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm text-clay-600 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Picker — bottom sheet on mobile, anchored popover on desktop. Both
          modes are owned by PickerSurface so we get scrim, drag handle, body
          scroll lock, Esc-to-close, focus restoration, and reduced-motion
          fallbacks for free. */}
      {!pinned && (
        <PickerSurface
          isOpen={picker !== null}
          onClose={() => setPicker(null)}
          mode="anchored"
          triggerRef={
            picker === "piece" ? pieceTriggerRef : collectionTriggerRef
          }
          ariaLabel={
            picker === "piece"
              ? "Pick a piece to add to"
              : "Pick a collection to add to"
          }
        >
          {/* Header — same shape as AddToContainerModal so the two pickers
              feel like the same surface from either entry point. */}
          <div className="px-5 py-4 border-b border-clay-200 dark:border-earth-600 flex items-start justify-between gap-3 flex-shrink-0">
            <h2 className="text-base font-semibold text-clay-800 dark:text-clay-200">
              Add {count} {count === 1 ? "item" : "items"} to{" "}
              {picker === "piece" ? "a piece" : "a collection"}
            </h2>
            <button
              type="button"
              onClick={() => setPicker(null)}
              aria-label="Close"
              className="shrink-0 p-1.5 rounded-lg hover:bg-clay-100 dark:hover:bg-earth-700 text-clay-500 dark:text-clay-400 transition-colors focus-ring"
            >
              <Close size="lg" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" layout="inline" />
              </div>
            ) : creating ? (
              /* Inline create form — takes over the body like
                 AddToContainerModal does, so the picker has one consistent
                 "flip to a form" pattern instead of an inline footer here
                 and a body flip there. */
              <div className="p-5 space-y-3">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (picker === "piece") createPieceWithItems();
                      else createCollectionWithItems();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  placeholder={
                    picker === "piece" ? "Piece name" : "Collection name"
                  }
                  className="w-full px-4 py-2 rounded-lg border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-700 text-clay-800 dark:text-clay-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 focus:border-terracotta-400"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="px-4 py-2 text-sm text-clay-600 dark:text-clay-400 hover:text-clay-800 dark:hover:text-clay-200 focus-ring rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (picker === "piece") createPieceWithItems();
                      else createCollectionWithItems();
                    }}
                    disabled={!newName.trim() || busy}
                    className="px-4 py-2 text-sm rounded-lg bg-terracotta-500 text-white hover:bg-terracotta-600 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                  >
                    {busy ? "…" : "Create & Add"}
                  </button>
                </div>
              </div>
            ) : picker === "piece" ? (
              <>
                <PickerRow
                  role="button"
                  onClick={() => setCreating(true)}
                  className="text-terracotta-600 dark:text-terracotta-400"
                >
                  <Plus size="lg" />
                  <span className="flex-1 text-sm font-medium">
                    Create new piece
                  </span>
                </PickerRow>
                {(pieces?.length ?? 0) === 0 ? (
                  <p className="px-5 py-8 text-sm text-clay-500 dark:text-clay-400 text-center">
                    No active pieces yet.
                  </p>
                ) : (
                  pieces!.map((p) => (
                    <PickerRow
                      key={p.id}
                      role="button"
                      onClick={() => addToPiece(p.id, p.name)}
                      isDisabled={busy}
                    >
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STAGE_BADGE_COLORS[p.currentStage]}`}
                      >
                        {STAGE_LABELS[p.currentStage]}
                      </span>
                      <span className="flex-1 text-sm font-medium text-clay-800 dark:text-clay-200 truncate">
                        {p.name}
                      </span>
                    </PickerRow>
                  ))
                )}
              </>
            ) : (
              <>
                <PickerRow
                  role="button"
                  onClick={() => setCreating(true)}
                  className="text-terracotta-600 dark:text-terracotta-400"
                >
                  <Plus size="lg" />
                  <span className="flex-1 text-sm font-medium">
                    Create new collection
                  </span>
                </PickerRow>
                {(collections?.length ?? 0) === 0 ? (
                  <p className="px-5 py-8 text-sm text-clay-500 dark:text-clay-400 text-center">
                    No collections yet.
                  </p>
                ) : (
                  collections!.map((c) => (
                    <PickerRow
                      key={c.id}
                      role="button"
                      onClick={() => addToCollection(c.id, c.name)}
                      isDisabled={busy}
                    >
                      {/* Same pill as AddToContainerModal so the leading
                          meta column reads as a consistent visual column. */}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 shrink-0">
                        {c.likes.length} item{c.likes.length === 1 ? "" : "s"}
                      </span>
                      <span className="flex-1 text-sm font-medium text-clay-800 dark:text-clay-200 truncate">
                        {c.name}
                      </span>
                    </PickerRow>
                  ))
                )}
              </>
            )}
          </div>
        </PickerSurface>
      )}

      {/* Spacer so the sticky bar doesn't cover the last row of the grid.
          When nothing is selected the bar collapses to one row (~52px); when
          something is selected it grows to two rows (~104px). Reserve the
          taller height so the grid doesn't shift between the two states. */}
      <div aria-hidden="true" style={{ height: "7rem" }} />
    </>
  );
}
