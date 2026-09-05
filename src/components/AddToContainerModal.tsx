/**
 * Generic "add this glaze/combo to a container" modal.
 *
 * Replaces the duplicated AddToCollectionModal + AddToPieceModal. A container
 * is anything the user can add inspo to — currently `"collection"` (saved
 * inspiration boards) or `"piece"` (active studio log entries).
 *
 * Behavior contract for each kind is declared once in `CONTAINER_BEHAVIORS`
 * below: how to load the list, decide if the item is already in a container,
 * toggle membership, and (only for collections) create a new empty one.
 */

import { useCallback, useEffect, useId, useMemo, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import {
  createCollection,
  getCollections,
  updateCollection,
} from "../api/collectionsApi";
import { createPiece, listPieces, getPiece } from "../api/piecesApi";
import { STAGE_BADGE_COLORS, STAGE_LABELS } from "../lib/pieceStages";
import { Check, Close, Plus } from "./Icons";
import { PickerRow } from "./PickerRow";
import { PickerSurface } from "./PickerSurface";
import { SearchInput } from "./SearchInput";
import { Spinner } from "./Spinner";
import type { Collection, CollectionItem, PotteryPiece } from "../types/models";

// =============================================================================
// Public props
// =============================================================================

export type ContainerKind = "collection" | "piece";

export interface AddToContainerModalProps {
  kind: ContainerKind;
  isOpen: boolean;
  onClose: () => void;
  itemType: "glaze" | "combination";
  itemId: string;
  itemName: string;
  /**
   * Optional ref to the element that opened this surface. When provided
   * the picker renders as an anchored dropdown under that trigger on
   * desktop (and falls back to a bottom sheet on mobile). When omitted,
   * the picker renders as a centered modal.
   */
  triggerRef?: RefObject<HTMLElement | null>;
}

// =============================================================================
// Behavior contract
// =============================================================================

interface ContainerBehavior<C> {
  /** Single, capitalized noun shown in the header. */
  label: string;
  /** Pluralized lowercase form. */
  plural: string;
  /** Whether the user can create a new empty container from the modal. */
  supportsCreate: boolean;
  /** Fetch all containers owned by the user. */
  load: (userId: string | undefined) => Promise<C[]>;
  /** Is `item` already on this container? */
  contains: (
    container: C,
    item: { type: "glaze" | "combination"; id: string },
  ) => boolean;
  /** Add or remove `item` from `container`. Returns the updated container. */
  toggle: (
    container: C,
    item: { type: "glaze" | "combination"; id: string; action: "add" | "remove" },
    userId: string,
  ) => Promise<C | null>;
  /** Create a new container with the given name (and optionally seed the item). */
  create?: (
    name: string,
    item: { type: "glaze" | "combination"; id: string },
    userId: string | undefined,
  ) => Promise<C>;
  /** Per-container row renderer (icon/badge + name + meta). */
  renderRow: (container: C) => { id: string; name: string; meta?: React.ReactNode };
}

// =============================================================================
// Concrete behaviors
// =============================================================================

const collectionBehavior: ContainerBehavior<Collection> = {
  label: "Collection",
  plural: "collections",
  supportsCreate: true,
  load: (userId) => getCollections(userId),
  contains: (c, item) =>
    c.likes.some((l) => l.type === item.type && l.id === item.id),
  toggle: async (c, item, userId) => {
    const next: CollectionItem[] =
      item.action === "add"
        ? [
            ...c.likes,
            { type: item.type, id: item.id, likedAt: new Date().toISOString() },
          ]
        : c.likes.filter((l) => !(l.type === item.type && l.id === item.id));
    return updateCollection(c.id, { likes: next }, userId);
  },
  create: (name, item, userId) =>
    createCollection(
      name,
      [{ type: item.type, id: item.id, likedAt: new Date().toISOString() }],
      undefined,
      userId,
    ),
  renderRow: (c) => ({
    id: c.id,
    name: c.name,
    meta: (
      // Pill — same shape as the stage badges on piece rows so the leading
      // metadata column reads as a consistent visual column whether you're
      // adding to a collection or a piece.
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300">
        {c.likes.length} item{c.likes.length !== 1 ? "s" : ""}
      </span>
    ),
  }),
};

const pieceBehavior: ContainerBehavior<PotteryPiece> = {
  label: "Piece",
  plural: "pieces",
  supportsCreate: true,
  load: async (userId) => {
    if (!userId) return [];
    const all = await listPieces(userId);
    return all.filter((p) => !p.isArchived);
  },
  // The piece's `inspoLikes` is a denormalized read-only mirror of its
  // attached inspo collection's likes — inlined on every GET so this check
  // doesn't need a second request per row.
  contains: (p, item) =>
    (p.inspoLikes || []).some((i) => i.type === item.type && i.id === item.id),
  // Mutations go through the collections API on the piece's inspo
  // collection. We refetch the piece after writing so the next render sees
  // the updated `inspoLikes`.
  toggle: async (p, item, userId) => {
    if (!p.inspoCollectionId) return p;
    const current = p.inspoLikes || [];
    const next: CollectionItem[] =
      item.action === "add"
        ? current.some((l) => l.type === item.type && l.id === item.id)
          ? current
          : [
              ...current,
              {
                type: item.type,
                id: item.id,
                likedAt: new Date().toISOString(),
              },
            ]
        : current.filter((l) => !(l.type === item.type && l.id === item.id));
    await updateCollection(p.inspoCollectionId, { likes: next }, userId);
    return getPiece(p.id);
  },
  // Creates a name-only piece, then seeds its inspo collection with the
  // item. The server auto-provisions `inspoCollectionId` on piece create,
  // so the second step is a normal collection update.
  create: async (name, item, userId) => {
    const piece = await createPiece({ name });
    if (piece.inspoCollectionId && userId) {
      await updateCollection(
        piece.inspoCollectionId,
        {
          likes: [
            { type: item.type, id: item.id, likedAt: new Date().toISOString() },
          ],
        },
        userId,
      );
      return getPiece(piece.id);
    }
    return piece;
  },
  renderRow: (p) => ({
    id: p.id,
    name: p.name,
    meta: (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE_COLORS[p.currentStage]}`}
      >
        {STAGE_LABELS[p.currentStage]}
      </span>
    ),
  }),
};

const BEHAVIORS = {
  collection: collectionBehavior,
  piece: pieceBehavior,
} as const;

// =============================================================================
// Component
// =============================================================================

export function AddToContainerModal({
  kind,
  isOpen,
  onClose,
  itemType,
  itemId,
  itemName,
  triggerRef,
}: AddToContainerModalProps) {
  const behavior = BEHAVIORS[kind] as ContainerBehavior<Collection | PotteryPiece>;
  const { user } = useAuth();
  const reactId = useId();
  const [containers, setContainers] = useState<Array<Collection | PotteryPiece>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const list = await behavior.load(user?.uid);
    setContainers(list);
    setIsLoading(false);
  }, [behavior, user?.uid]);

  useEffect(() => {
    if (!isOpen) return;
    setIsCreatingNew(false);
    setNewName("");
    setSearch("");
    setSuccessMessage(null);
    load();
  }, [isOpen, load]);

  const handleToggle = async (container: Collection | PotteryPiece) => {
    if (!user || toggling) return;
    const already = behavior.contains(container, { type: itemType, id: itemId });
    setToggling(container.id);
    try {
      const updated = await behavior.toggle(
        container,
        { type: itemType, id: itemId, action: already ? "remove" : "add" },
        user.uid,
      );
      if (updated) {
        setContainers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
      const name = behavior.renderRow(container).name;
      setSuccessMessage(
        already ? `Removed from "${name}"` : `Added to "${name}"`,
      );
      setTimeout(() => setSuccessMessage(null), 1500);
    } finally {
      setToggling(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newName.trim() || !behavior.create) return;
    const created = await behavior.create(
      newName.trim(),
      { type: itemType, id: itemId },
      user?.uid,
    );
    const createdName =
      created && "name" in created
        ? (created as Collection | PotteryPiece).name
        : behavior.label.toLowerCase();
    setSuccessMessage(`Created "${createdName}" and added!`);
    await load();
    setIsCreatingNew(false);
    setNewName("");
    setTimeout(() => setSuccessMessage(null), 1500);
  };

  const titleId = `add-to-container-${reactId}`;
  const showSearch = !isLoading && !isCreatingNew && containers.length > 5;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return containers;
    return containers.filter((c) =>
      behavior.renderRow(c).name.toLowerCase().includes(q),
    );
  }, [containers, search, behavior]);

  if (!isOpen) return null;

  return (
    <PickerSurface
      isOpen={isOpen}
      onClose={onClose}
      mode={triggerRef ? "anchored" : "dialog"}
      triggerRef={triggerRef}
      dialogSize="md"
      anchoredMinWidth={320}
      anchoredMaxWidth={420}
      ariaLabelledBy={titleId}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-clay-200 dark:border-earth-600 flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-base font-semibold text-clay-800 dark:text-clay-200"
          >
            Add to {behavior.label.toLowerCase()}
          </h2>
          <p className="text-sm text-clay-500 dark:text-clay-400 mt-0.5 truncate">
            {itemName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 p-1.5 rounded-lg hover:bg-clay-100 dark:hover:bg-earth-700 text-clay-500 dark:text-clay-400 transition-colors focus-ring"
        >
          <Close size="lg" />
        </button>
      </div>

      {/* Inline success banner */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 py-2 bg-sage-50 dark:bg-sage-900/20 border-b border-sage-200 dark:border-sage-800 flex-shrink-0"
          >
            <p className="text-sm text-sage-700 dark:text-sage-300 flex items-center gap-1.5">
              <Check />
              {successMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search header (only when there's enough to search) */}
      {showSearch && (
        <div className="px-4 py-3 border-b border-clay-200 dark:border-earth-600 bg-white dark:bg-earth-800 flex-shrink-0">
          <SearchInput
            placeholder={`Search ${behavior.plural}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={`Search ${behavior.plural}`}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" layout="inline" className="h-6 w-6" />
          </div>
        ) : isCreatingNew && behavior.supportsCreate ? (
          <div className="p-5 space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
              autoFocus
              placeholder={`${behavior.label} name`}
              className="w-full px-4 py-2 rounded-lg border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-700 text-clay-800 dark:text-clay-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 focus:border-terracotta-400"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewName("");
                }}
                className="px-4 py-2 text-sm text-clay-600 dark:text-clay-400 hover:text-clay-800 dark:hover:text-clay-200 focus-ring rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAndAdd}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-terracotta-500 text-white hover:bg-terracotta-600 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              >
                Create & Add
              </button>
            </div>
          </div>
        ) : containers.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-3">
            <p className="text-sm text-clay-500 dark:text-clay-400">
              No {behavior.plural} yet.
            </p>
            {behavior.supportsCreate && (
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-terracotta-500 text-white hover:bg-terracotta-600 transition-colors focus-ring"
              >
                <Plus />
                Create your first {behavior.label.toLowerCase()}
              </button>
            )}
          </div>
        ) : (
          <>
            {behavior.supportsCreate && (
              <PickerRow
                role="button"
                onClick={() => setIsCreatingNew(true)}
                className="text-terracotta-600 dark:text-terracotta-400"
              >
                <Plus size="lg" />
                <span className="flex-1 text-sm font-medium">
                  Create new {behavior.label.toLowerCase()}
                </span>
              </PickerRow>
            )}

            {filtered.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-clay-500 dark:text-clay-400">
                No {behavior.plural} match “{search}”.
              </p>
            ) : (
              filtered.map((container) => {
                const row = behavior.renderRow(container);
                const added = behavior.contains(container, {
                  type: itemType,
                  id: itemId,
                });
                const isThisToggling = toggling === container.id;
                return (
                  <PickerRow
                    key={container.id}
                    role="button"
                    onClick={() => handleToggle(container)}
                    isSelected={added}
                    isDisabled={!!toggling}
                  >
                    {row.meta}
                    <span className="flex-1 text-sm font-medium text-clay-800 dark:text-clay-200 truncate">
                      {row.name}
                    </span>
                    {/* Trailing slot is reserved for state, not affordance.
                        The whole row is already tappable; a trailing `+`
                        next to the leading `+ Create new` row was making
                        the two visually interchangeable. Only the check
                        appears here \u2014 the absence of a check is the
                        "not added yet" state. */}
                    {isThisToggling ? (
                      <Spinner
                        size="sm"
                        layout="inline"
                        className="shrink-0 h-5 w-5"
                      />
                    ) : added ? (
                      <Check className="w-5 h-5 text-sage-600 dark:text-sage-400 shrink-0" />
                    ) : null}
                  </PickerRow>
                );
              })
            )}
          </>
        )}
      </div>
    </PickerSurface>
  );
}

// =============================================================================
// (Inline icons no longer needed — the modal uses shared `Icons.*`.)

