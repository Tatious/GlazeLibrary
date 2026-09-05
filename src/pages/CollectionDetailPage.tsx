/**
 * Collection Detail Page
 * View a saved discover collection with all liked glazes and combinations.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useGlazes, useCombinations } from "../hooks/useGlazeData";
import {
  getCollection,
  updateCollection,
  deleteCollection,
} from "../api/collectionsApi";
import { getPrimaryImage } from "../utils/glazeUtils";
import { useAuth } from "../hooks/useAuth";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { Spinner } from "../components/Spinner";
import { ConfirmAction } from "../components/ConfirmAction";
import { CombinationCard } from "../components/CombinationCard";
import { EmptyState } from "../components/EmptyState";
import { PageLayout } from "../components/PageLayout";
import {
  Close,
  Inbox,
  Pencil,
} from "../components/Icons";
import type { Collection, Glaze, GlazeCombination } from "../types/models";

export function CollectionDetailPage() {
  // Collections are per-user \u2014 redirect signed-out visitors to /login.
  useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: glazes = [] } = useGlazes();
  const { data: combinations = [] } = useCombinations();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadCollection = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const c = await getCollection(id, user?.uid);
    setCollection(c);
    if (c) {
      setEditName(c.name);
      setEditNotes(c.notes || "");
    }
    setIsLoading(false);
  }, [id, user?.uid]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  // Collections attached to a piece are owned by the piece's UI — bounce
  // the user to the piece so they don't accidentally edit (or delete!) the
  // inspo board via the standalone collection screen.
  useEffect(() => {
    if (collection?.attachedToPieceId) {
      navigate(`/pieces/${collection.attachedToPieceId}`, { replace: true });
    }
  }, [collection?.attachedToPieceId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Spinner size="md" layout="inline" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200">
            Collection not found
          </h2>
          <Link
            to="/collections"
            className="mt-4 inline-block text-terracotta-600 dark:text-terracotta-400 hover:underline"
          >
            Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  const likedGlazes = collection.likes
    .filter((l) => l.type === "glaze")
    .map((l) => glazes.find((g) => g.id === l.id))
    .filter(Boolean) as Glaze[];

  const likedCombinations = collection.likes
    .filter((l) => l.type === "combination")
    .map((l) => combinations.find((c) => c.id === l.id))
    .filter(Boolean) as GlazeCombination[];

  const handleSave = async () => {
    if (!editName.trim()) return;
    await updateCollection(
      collection.id,
      {
        name: editName.trim(),
        notes: editNotes.trim() || undefined,
      },
      user?.uid,
    );
    await loadCollection();
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteCollection(collection.id, user?.uid);
    navigate("/collections");
  };

  const handleRemoveItem = async (
    type: "glaze" | "combination",
    itemId: string,
  ) => {
    const newLikes = collection.likes.filter(
      (l) => !(l.type === type && l.id === itemId),
    );
    await updateCollection(collection.id, { likes: newLikes }, user?.uid);
    await loadCollection();
  };

  // Reset the swipe deck's rejected pile so previously-passed items come
  // back into Discover. Liked items are left untouched.
  const handleResetRejected = async () => {
    if (!collection.swipeProgress?.rejected?.length) return;
    await updateCollection(
      collection.id,
      {
        swipeProgress: {
          ...collection.swipeProgress,
          rejected: [],
        },
      },
      user?.uid,
    );
    await loadCollection();
  };

  return (
    <PageLayout maxWidth="7xl" padY="6">
      {/* Breadcrumb — same pattern as PieceDetail so the two
          container-detail pages feel like siblings. */}
      <div className="flex items-center gap-2 text-sm mb-3">
        <Link
          to="/collections"
          className="text-clay-500 dark:text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
        >
          Collections
        </Link>
        <span className="text-clay-400 dark:text-clay-500">›</span>
        <span className="text-clay-600 dark:text-clay-300 truncate">
          {collection.name}
        </span>
      </div>

      {/* Page-flush title + edit pencil (icon-only, matches PieceDetail).
          Destructive Delete moved to a dedicated Actions section below
          so the header isn't a mixed bag of save / destroy controls. */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1 text-2xl font-bold bg-white dark:bg-earth-700 border border-clay-300 dark:border-earth-600 rounded-lg text-clay-800 dark:text-clay-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                autoFocus
              />
            ) : (
              <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 truncate">
                {collection.name}
              </h1>
            )}
            <p className="text-sm text-clay-500 dark:text-clay-400 mt-1">
              Created {new Date(collection.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-clay-600 dark:text-clay-400 hover:text-clay-800 dark:hover:text-clay-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editName.trim()}
                  className="px-3 py-1.5 text-sm bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-lg text-clay-500 hover:text-clay-700 dark:hover:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-700 transition-colors"
                title="Edit"
                aria-label="Edit collection"
              >
                <Pencil />
              </button>
            )}
          </div>
        </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <ConfirmAction
          layout="modal"
          message={
            <>
              <p className="text-base font-semibold text-clay-800 dark:text-clay-200 mb-2">
                Delete Collection?
              </p>
              <p className="text-clay-600 dark:text-clay-400">
                This will permanently delete "{collection.name}" and all its
                saved items. This cannot be undone.
              </p>
            </>
          }
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Add-picks pill row — matches PieceDetail's Glaze Inspo "Browse" /
          "Add more" row. Three parallel entry points all converge on the
          same `likes` array. Reset-hidden affordance sits beside the pills
          when the swipe deck has anything to surface. */}
      {!isEditing && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-clay-400 dark:text-clay-500">
            {collection.likes.length === 0 ? "Browse:" : "Add more:"}
          </span>
          <Link
            to={`/glazes?addTo=collection:${collection.id}`}
            className="px-3 py-1 rounded-full text-sm font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/30 hover:text-terracotta-700 dark:hover:text-terracotta-400 transition-colors"
          >
            Glazes
          </Link>
          <Link
            to={`/combinations?addTo=collection:${collection.id}`}
            className="px-3 py-1 rounded-full text-sm font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/30 hover:text-terracotta-700 dark:hover:text-terracotta-400 transition-colors"
          >
            Combos
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/discover/use?edit=${collection.id}`)}
            className="px-3 py-1 rounded-full text-sm font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-terracotta-100 dark:hover:bg-terracotta-900/30 hover:text-terracotta-700 dark:hover:text-terracotta-400 transition-colors"
          >
            Discover
          </button>
          {(collection.swipeProgress?.rejected?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={handleResetRejected}
              className="ml-auto text-xs text-terracotta-600 dark:text-terracotta-400 hover:underline"
              title="Show items you previously swiped left on"
            >
              Reset {collection.swipeProgress?.rejected.length} hidden
            </button>
          )}
        </div>
      )}

      {/* Notes section (editing mode) */}
      {isEditing && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-2">
            Notes
          </label>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Add notes about this collection..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-earth-700 border border-clay-300 dark:border-earth-600 rounded-lg text-clay-800 dark:text-clay-200 placeholder-clay-400 dark:placeholder-clay-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
          />
        </div>
      )}

      {/* Notes display */}
      {!isEditing && collection.notes && (
        <div className="mb-4 p-3 bg-clay-50 dark:bg-earth-800 rounded-lg border border-clay-200 dark:border-earth-700">
          <p className="text-sm text-clay-700 dark:text-clay-300">
            {collection.notes}
          </p>
        </div>
      )}

        {/* Liked glazes */}
        {likedGlazes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-3">
              Glazes
            </h2>
            <div className="grid grid-cols-2 xsl:grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {likedGlazes.map((glaze) => (
                <div
                  key={glaze.id}
                  className="group relative bg-white dark:bg-earth-800 rounded-lg overflow-hidden border border-clay-200 dark:border-earth-700"
                >
                  <Link
                    to={`/glaze/${glaze.id}`}
                    state={{ fromCollection: collection.id }}
                  >
                    <div className="aspect-square bg-clay-100 dark:bg-earth-700">
                      {getPrimaryImage(glaze) ? (
                        <img
                          src={getPrimaryImage(glaze) || ""}
                          alt={glaze.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-clay-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium text-clay-800 dark:text-clay-200 truncate">
                        {glaze.displayName}
                      </p>
                      <p className="text-xs text-clay-500 dark:text-clay-400 truncate">
                        {glaze.brand}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveItem("glaze", glaze.id);
                    }}
                    className="absolute top-1.5 right-1.5 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-earth-900/85 text-clay-700 dark:text-clay-200 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white shadow-md backdrop-blur-sm transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    title="Remove from collection"
                    aria-label={`Remove ${glaze.displayName} from collection`}
                  >
                    <Close strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liked combinations — uses the canonical CombinationCard so it
            matches every other combo grid in the app (/combinations, the
            shop, In Combinations on glaze detail). The remove button sits
            on top because CombinationCard itself doesn't know about the
            collection. */}
        {likedCombinations.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-3">
              Combinations ({likedCombinations.length})
            </h2>
            <div className="grid grid-cols-2 xsl:grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {likedCombinations.map((combo) => (
                <div key={combo.id} className="relative">
                  <CombinationCard combination={combo} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveItem("combination", combo.id);
                    }}
                    className="absolute top-1.5 right-1.5 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-earth-900/85 text-clay-700 dark:text-clay-200 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white shadow-md backdrop-blur-sm transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    title="Remove from collection"
                    aria-label={`Remove ${combo.topGlaze.displayName} over ${combo.bottomGlaze.displayName} from collection`}
                  >
                    <Close strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {collection.likes.length === 0 && (
          <EmptyState
            variant="bare"
            icon={<Inbox size="2xl" />}
            title="This collection is empty."
          />
        )}

        {/* Destructive Actions — lives at the bottom rather than in the
            header so it doesn't sit next to constructive actions like Edit.
            Mirrors PieceDetail's Actions section so the two pages stay
            structurally identical. */}
        {!isEditing && (
          <div className="mt-8 pt-4 border-t border-clay-200 dark:border-earth-700">
            <h2 className="text-sm font-semibold text-clay-500 dark:text-clay-400 uppercase tracking-wide mb-3">
              Actions
            </h2>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete collection
            </button>
          </div>
        )}
    </PageLayout>
  );
}
