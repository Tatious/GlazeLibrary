/**
 * Discover Page — Tinder-style swiping that builds a collection's `likes`.
 *
 * Two flows, distinguished by URL:
 *
 *   /discover/use
 *     Guest / "new collection" flow. State lives in sessionStorage until
 *     the user hits Done and saves into a real collection (or appends to
 *     an existing one) via the ResultsView.
 *
 *   /discover/use?edit=<collectionId>[&returnTo=...]
 *     Editing an existing collection. Covers BOTH standalone collections
 *     reached from /collections/:id AND piece inspo (whose hidden
 *     collection id is exposed on `piece.inspoCollectionId`). Likes +
 *     swipe progress are auto-saved to the collection; "Done" returns to
 *     `returnTo` if provided, else `/collections/:id`.
 *
 * The owned-only toggle scopes the deck pool. Off shows the full catalog
 * so the user can pick aspirational picks (it's the collection that
 * decides what "owned" means in context; inspo isn't gated on inventory).
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGlazes, useCombinations, useMyGlazes } from "../hooks/useGlazeData";
import { ResultsView } from "../components/discover/ResultsView";
import { Spinner } from "../components/Spinner";
import { SwipeCard, type DiscoverItem } from "../components/discover/SwipeCard";
import {
  Check,
  Close,
  InventoryDownload,
  Plus,
} from "../components/Icons";
import {
  createCollection,
  updateCollection,
  getCollection,
  getCollections,
} from "../api/collectionsApi";
import { useAuth } from "../hooks/useAuth";
import type { CollectionItem, Collection } from "../types/models";
import { STORAGE_KEYS } from "../config/storageKeys";
import { itemKey, normalizeKeys } from "../utils/itemKey";

type DiscoverMode = "all" | "glazes" | "combinations";

// Stable per-item position. A 32-bit FNV-1a of `${seed}:${type}:${id}` puts
// every item at the same offset regardless of pool composition — flipping
// `onlyOwned` or `mode` mid-session no longer reshuffles cards already
// seen, which was the source of the "order keeps changing" bug.
function stablePosition(seed: number, key: string): number {
  let h = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function stringToSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

interface UnsavedSession {
  mode: DiscoverMode;
  onlyOwned: boolean;
  rejected: string[];
  likes: CollectionItem[];
  shuffleSeed: number;
  showResults: boolean;
  collectionName: string;
}

function readUnsaved(): UnsavedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.DISCOVER_UNSAVED_SESSION);
    return raw ? (JSON.parse(raw) as UnsavedSession) : null;
  } catch {
    return null;
  }
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editCollectionId = searchParams.get("edit");
  const freshStart = searchParams.get("fresh");
  const returnTo = searchParams.get("returnTo");
  const { user } = useAuth();

  const { data: glazes = [], isLoading: glazesLoading } = useGlazes();
  const { data: combinations = [], isLoading: combosLoading } =
    useCombinations();
  const myGlazes = useMyGlazes();

  // Clear unsaved session on ?fresh=1 and strip the param so reloads don't
  // re-clear. All other params (`edit`, `returnTo`) are preserved.
  useEffect(() => {
    if (!freshStart) return;
    sessionStorage.removeItem(STORAGE_KEYS.DISCOVER_UNSAVED_SESSION);
    const next = new URLSearchParams(searchParams);
    next.delete("fresh");
    const qs = next.toString();
    navigate(`/discover/use${qs ? `?${qs}` : ""}`, { replace: true });
  }, [freshStart, navigate, searchParams]);

  // Restore unsaved session ONLY for the "new collection" guest/no-edit
  // flow. Editing an existing collection always loads from the server.
  const savedSession = useMemo<UnsavedSession | null>(() => {
    if (editCollectionId || freshStart) return null;
    return readUnsaved();
  }, [editCollectionId, freshStart]);

  // ---- Local state ----
  const [mode, setMode] = useState<DiscoverMode>(savedSession?.mode ?? "all");
  const [onlyOwned, setOnlyOwned] = useState<boolean>(
    savedSession?.onlyOwned ?? true,
  );
  // Canonical "type:id" keys for items the user swiped left on. Persisted to
  // the collection's swipeProgress so the deck doesn't show them again.
  const [rejected, setRejected] = useState<Set<string>>(
    () => new Set(savedSession?.rejected ?? []),
  );
  const [likes, setLikes] = useState<CollectionItem[]>(
    savedSession?.likes ?? [],
  );
  const [shuffleSeed, setShuffleSeed] = useState<number>(() => {
    if (editCollectionId) return stringToSeed(editCollectionId);
    return savedSession?.shuffleSeed ?? Date.now();
  });
  const [showResults, setShowResults] = useState<boolean>(
    savedSession?.showResults ?? false,
  );
  const [collectionName, setCollectionName] = useState<string>(
    savedSession?.collectionName ?? "",
  );
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null,
  );
  // Save target for the new-collection flow: null means "create a fresh
  // collection from `collectionName`"; non-null means "append to this one".
  const [addToCollectionId, setAddToCollectionId] = useState<string | null>(
    null,
  );

  // List of the user's existing collections so the Results view can offer
  // "add to existing" alongside "create new". Hidden piece-attached
  // collections are excluded by the server.
  const [savedCollections, setSavedCollections] = useState<Collection[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getCollections(user?.uid);
      if (!cancelled) setSavedCollections(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Load the collection being edited; its likes + swipeProgress become the
  // initial state for this session.
  useEffect(() => {
    if (!editCollectionId) {
      setEditingCollection(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const c = await getCollection(editCollectionId, user?.uid);
      if (cancelled || !c) return;
      setEditingCollection(c);
      setLikes(c.likes);
      setCollectionName(c.name);
      if (c.swipeProgress?.rejected) {
        setRejected(normalizeKeys(c.swipeProgress.rejected));
      }
      if (c.swipeProgress?.shuffleSeed) {
        setShuffleSeed(c.swipeProgress.shuffleSeed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editCollectionId, user?.uid]);

  // Persist the new-collection draft to sessionStorage. Skipped when
  // editing — that flow auto-saves to the server instead.
  useEffect(() => {
    if (editCollectionId) {
      sessionStorage.removeItem(STORAGE_KEYS.DISCOVER_UNSAVED_SESSION);
      return;
    }
    const session: UnsavedSession = {
      mode,
      onlyOwned,
      rejected: Array.from(rejected),
      likes,
      shuffleSeed,
      showResults,
      collectionName,
    };
    sessionStorage.setItem(
      STORAGE_KEYS.DISCOVER_UNSAVED_SESSION,
      JSON.stringify(session),
    );
  }, [
    editCollectionId,
    mode,
    onlyOwned,
    rejected,
    likes,
    shuffleSeed,
    showResults,
    collectionName,
  ]);

  // Auto-save likes + progress to the server when editing. Debounced so a
  // burst of swipes coalesces into a single PUT. The cleanup `clearTimeout`
  // also handles unmount — the pending save is dropped, but the next mount
  // re-reads from the server, so nothing is lost.
  useEffect(() => {
    if (!editCollectionId) return;
    const timeoutId = window.setTimeout(() => {
      updateCollection(
        editCollectionId,
        {
          likes,
          swipeProgress: {
            rejected: Array.from(rejected),
            shuffleSeed,
          },
        },
        user?.uid,
      );
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [editCollectionId, likes, rejected, shuffleSeed, user?.uid]);

  // ---- Deck pool ----
  const ownedGlazeIds = useMemo(() => {
    return new Set(
      Object.entries(myGlazes.glazes)
        .filter(([, e]) => e.owned)
        .map(([id]) => id),
    );
  }, [myGlazes.glazes]);

  const glazePool = useMemo(() => {
    if (!onlyOwned) return glazes;
    return glazes.filter((g) => ownedGlazeIds.has(g.id));
  }, [glazes, ownedGlazeIds, onlyOwned]);

  const combinationPool = useMemo(() => {
    if (!onlyOwned) return combinations;
    return combinations.filter(
      (c) =>
        ownedGlazeIds.has(c.topGlaze.glazeId) &&
        ownedGlazeIds.has(c.bottomGlaze.glazeId),
    );
  }, [combinations, ownedGlazeIds, onlyOwned]);

  // ---- Sorted, filtered items ----
  // Each item gets a deterministic position from `(shuffleSeed, key)`. We
  // sort by that, THEN filter out likes/rejected — so toggling `onlyOwned`
  // or `mode` mid-session never reorders the remaining cards.
  const items = useMemo<DiscoverItem[]>(() => {
    const likedKeys = new Set(likes.map((l) => itemKey(l)));
    const skip = new Set<string>([...likedKeys, ...rejected]);

    type Sortable = { item: DiscoverItem; pos: number };
    const buf: Sortable[] = [];

    if (mode !== "combinations") {
      for (const g of glazePool) {
        const key = itemKey({ type: "glaze", id: g.id });
        if (skip.has(key)) continue;
        buf.push({
          item: { type: "glaze", data: g },
          pos: stablePosition(shuffleSeed, key),
        });
      }
    }
    if (mode !== "glazes") {
      for (const c of combinationPool) {
        const key = itemKey({ type: "combination", id: c.id });
        if (skip.has(key)) continue;
        buf.push({
          item: { type: "combination", data: c },
          pos: stablePosition(shuffleSeed, key),
        });
      }
    }

    buf.sort((a, b) => a.pos - b.pos);
    return buf.map((b) => b.item);
  }, [glazePool, combinationPool, mode, likes, rejected, shuffleSeed]);

  const currentItem = items[0];
  const isComplete = items.length === 0;
  const isLoading = glazesLoading || combosLoading;

  // ---- Progress counter ----
  // Total = everything in the deck pool for the current mode.
  // Processed = liked + rejected within that same mode.
  const modeTotal = useMemo(() => {
    if (mode === "glazes") return glazePool.length;
    if (mode === "combinations") return combinationPool.length;
    return glazePool.length + combinationPool.length;
  }, [mode, glazePool, combinationPool]);

  const modeProcessed = useMemo(() => {
    const wantedType =
      mode === "glazes" ? "glaze" : mode === "combinations" ? "combination" : null;
    const liked = wantedType
      ? likes.filter((l) => l.type === wantedType).length
      : likes.length;
    const rejectedCount = wantedType
      ? Array.from(rejected).filter((k) => k.startsWith(`${wantedType}:`)).length
      : rejected.size;
    return liked + rejectedCount;
  }, [mode, likes, rejected]);

  // ---- Actions ----
  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      if (!currentItem) return;
      const key = itemKey({
        type: currentItem.type,
        id: currentItem.data.id,
      });
      if (direction === "right") {
        setLikes((prev) => [
          ...prev,
          {
            type: currentItem.type,
            id: currentItem.data.id,
            likedAt: new Date().toISOString(),
          },
        ]);
      } else {
        setRejected((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      }
    },
    [currentItem],
  );

  // Keyboard nav (desktop).
  useEffect(() => {
    if (showResults || isComplete || !currentItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSwipe("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSwipe("right");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showResults, isComplete, currentItem, handleSwipe]);

  // "Reset hidden": clears the rejected pile so previously-passed items
  // come back into the deck. Liked items are left alone.
  const handleResetRejected = useCallback(() => {
    setRejected(new Set());
  }, []);

  // ---- Save / Done ----
  const handleSaveCollection = async () => {
    sessionStorage.removeItem(STORAGE_KEYS.DISCOVER_UNSAVED_SESSION);
    const swipeProgress = {
      rejected: Array.from(rejected),
      shuffleSeed,
    };

    if (editCollectionId) {
      if (!collectionName.trim()) return;
      await updateCollection(
        editCollectionId,
        {
          name: collectionName.trim(),
          likes,
          swipeProgress,
        },
        user?.uid,
      );
      navigate(returnTo ?? `/collections/${editCollectionId}`);
      return;
    }

    if (addToCollectionId) {
      const target = savedCollections.find((c) => c.id === addToCollectionId);
      if (!target) return;
      const existing = new Set(target.likes.map((l) => `${l.type}:${l.id}`));
      const merged = [
        ...target.likes,
        ...likes.filter((l) => !existing.has(`${l.type}:${l.id}`)),
      ];
      await updateCollection(target.id, { likes: merged }, user?.uid);
      navigate(returnTo ?? `/collections/${target.id}`);
      return;
    }

    if (!collectionName.trim()) return;
    const created = await createCollection(
      collectionName.trim(),
      likes,
      undefined,
      user?.uid,
      swipeProgress,
    );
    navigate(returnTo ?? `/collections/${created.id}`);
  };

  // ---- Empty / loading early returns ----
  if (!isLoading && ownedGlazeIds.size === 0 && onlyOwned) {
    // Same "no inventory yet" state as before, but only when the user has
    // actually narrowed the deck to owned items. With `onlyOwned=false`
    // (aspirational mode) the deck is the whole catalog and is always
    // non-empty, so we never block on inventory in that branch.
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-clay-100 dark:bg-earth-700 flex items-center justify-center">
            <InventoryDownload
              className="w-10 h-10 text-clay-400"
              strokeWidth={1.5}
            />
          </div>
          <h2 className="text-xl font-bold text-clay-800 dark:text-clay-200 mb-2">
            No Glazes in Your Collection
          </h2>
          <p className="text-clay-600 dark:text-clay-400 mb-3">
            Mark some glazes as owned in the Glazes tab to swipe through your
            inventory, or browse the full catalog instead.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => navigate("/glazes")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors"
            >
              Go to Glazes
            </button>
            <button
              onClick={() => setOnlyOwned(false)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
            >
              Browse all glazes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner layout="inline" />
      </div>
    );
  }

  if (showResults || isComplete) {
    return (
      <ResultsView
        likes={likes}
        glazes={glazes}
        combinations={combinations}
        collectionName={collectionName}
        setCollectionName={setCollectionName}
        savedCollections={savedCollections}
        addToCollectionId={addToCollectionId}
        setAddToCollectionId={setAddToCollectionId}
        onSave={handleSaveCollection}
        onContinue={() => setShowResults(false)}
        onBack={() => setShowResults(false)}
        isComplete={isComplete}
        editingCollectionId={editCollectionId}
        hasMoreItems={items.length > 0}
      />
    );
  }

  // ---- Main swipe view ----
  const editingLabel = editingCollection?.attachedToPieceId
    ? "Adding inspo to your piece"
    : editingCollection
      ? `Editing: ${editingCollection.name}`
      : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-clay-200 dark:border-earth-700">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-clay-800 dark:text-clay-200">
            Glazes to Use
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-clay-500 dark:text-clay-400">
              {likes.length} picked
            </span>
            <button
              onClick={async () => {
                if (editCollectionId) {
                  // Flush pending progress before navigating — the debounced
                  // save might not have fired yet.
                  await updateCollection(
                    editCollectionId,
                    {
                      likes,
                      swipeProgress: {
                        rejected: Array.from(rejected),
                        shuffleSeed,
                      },
                    },
                    user?.uid,
                  );
                  navigate(returnTo ?? `/collections/${editCollectionId}`);
                } else {
                  setShowResults(true);
                }
              }}
              className="px-3 py-1.5 text-sm font-medium bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
        {editingLabel && (
          <div className="max-w-lg mx-auto mt-2">
            <span
              className={
                editingCollection?.attachedToPieceId
                  ? "text-xs text-terracotta-700 dark:text-terracotta-300 bg-terracotta-100 dark:bg-terracotta-900/30 px-2 py-1 rounded-full"
                  : "text-xs text-moss-600 dark:text-moss-400 bg-moss-100 dark:bg-moss-900/30 px-2 py-1 rounded-full"
              }
            >
              {editingLabel}
            </span>
          </div>
        )}
      </div>

      {/* Mode + owned toggle */}
      <div className="px-4 py-2 border-b border-clay-100 dark:border-earth-700/50">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          {(["all", "glazes", "combinations"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                mode === m
                  ? "bg-terracotta-500 text-white"
                  : "bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-400"
              }`}
            >
              {m === "all" ? "All" : m === "glazes" ? "Glazes" : "Combos"}
            </button>
          ))}
          <button
            onClick={() => setOnlyOwned((v) => !v)}
            className={`ml-auto px-3 py-1 text-sm rounded-full transition-colors inline-flex items-center gap-1.5 ${
              onlyOwned
                ? "bg-sage-200 text-sage-800 dark:bg-sage-800 dark:text-sage-200"
                : "bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-400"
            }`}
            title={
              onlyOwned
                ? "Showing only glazes you own"
                : "Showing all glazes, including ones you don't own"
            }
          >
            {onlyOwned && <Check />}
            Owned only
          </button>
        </div>
      </div>

      {/* Progress + reset-hidden */}
      <div className="px-4 py-2">
        <div className="max-w-lg mx-auto">
          <div className="h-1 bg-clay-200 dark:bg-earth-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-terracotta-500 transition-all duration-300"
              style={{
                width: `${
                  modeTotal > 0
                    ? (Math.min(modeProcessed, modeTotal) / modeTotal) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-3 mt-1">
            <p className="text-xs text-clay-500 dark:text-clay-400">
              {Math.min(modeProcessed + (isComplete ? 0 : 1), modeTotal)} of{" "}
              {modeTotal}
            </p>
            {rejected.size > 0 && (
              <button
                type="button"
                onClick={handleResetRejected}
                className="text-xs text-terracotta-600 dark:text-terracotta-400 hover:underline"
                title="Show items you previously swiped left on"
              >
                Reset {rejected.size} hidden
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <div
          className="relative w-full max-w-sm h-full max-h-[70vh] aspect-[3/4] landscape:aspect-[16/9] landscape:max-h-[55vh] landscape:max-w-lg"
          style={{ touchAction: "none" }}
        >
          {currentItem ? (
            <SwipeCard
              key={currentItem.data.id}
              item={currentItem}
              onSwipe={handleSwipe}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-clay-500 dark:text-clay-400 px-6">
              <p className="text-base font-medium mb-2">All done in this mode.</p>
              <p className="text-sm">
                Switch modes above, broaden the deck with{" "}
                <button
                  type="button"
                  onClick={() => setOnlyOwned(false)}
                  className="underline"
                >
                  all glazes
                </button>
                , or reset hidden items to see them again.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {currentItem && (
        <div className="px-4 pb-6">
          <div className="max-w-lg mx-auto flex justify-center gap-8">
            <button
              onClick={() => handleSwipe("left")}
              className="w-16 h-16 rounded-full bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-400 flex items-center justify-center hover:bg-clay-200 dark:hover:bg-earth-600 transition-colors shadow-lg"
              aria-label="Pass"
            >
              <Close size="2xl" />
            </button>
            <button
              onClick={() => handleSwipe("right")}
              className="w-16 h-16 rounded-full bg-moss-500 text-white flex items-center justify-center hover:bg-moss-600 transition-colors shadow-lg"
              aria-label="Pick"
            >
              <Plus size="2xl" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
