/**
 * Collections Page
 * List all saved discover collections.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGlazes, useCombinations } from "../hooks/useGlazeData";
import {
  getCollections,
  createCollection,
} from "../api/collectionsApi";
import { getPrimaryImage, getCombinationImage } from "../utils/glazeUtils";
import { useAuth } from "../hooks/useAuth";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { PageLayout } from "../components/PageLayout";
import { ChevronRight, Palette, Photo, Plus } from "../components/Icons";
import type { Collection } from "../types/models";

export function CollectionsPage() {
  // Collections are per-user \u2014 redirect signed-out visitors to /login
  // instead of showing them an empty page. Mirrors PiecesPage.
  useRequireAuth();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: glazes = [] } = useGlazes();
  const { data: combinations = [] } = useCombinations();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadCollections = useCallback(async () => {
    setIsLoading(true);
    const data = await getCollections(user?.uid);
    setCollections(data);
    setIsLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleCreate = async () => {
    if (!newName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const created = await createCollection(
        newName.trim(),
        [],
        undefined,
        user?.uid,
      );
      setShowNewModal(false);
      setNewName("");
      navigate(`/collections/${created.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Get preview images for a collection
  const getCollectionImages = (collection: Collection) => {
    const images: string[] = [];
    for (const like of collection.likes.slice(0, 4)) {
      if (like.type === "glaze") {
        const glaze = glazes.find((g) => g.id === like.id);
        if (glaze) {
          const img = getPrimaryImage(glaze);
          if (img) images.push(img);
        }
      } else {
        const combo = combinations.find((c) => c.id === like.id);
        if (combo) {
          const img = getCombinationImage(combo);
          if (img) images.push(img);
        }
      }
    }
    return images;
  };

  return (
    <PageLayout maxWidth="7xl" padY="8">
      {/* Header — mirrors PiecesPage: compact "+" icon on the right that
          stays on one row at every viewport width. */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200">
            Collections
          </h1>
          <p className="text-sm text-clay-500 dark:text-clay-400 mt-0.5">
            Save glazes & combos to revisit later
          </p>
        </div>
        {/* Header action hidden when empty — the empty-state CTA owns the
            discovery action there. */}
        {collections.length > 0 && (
          <button
            onClick={() => setShowNewModal(true)}
            aria-label="New collection"
            title="New collection"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white transition-colors"
          >
            <Plus />
          </button>
        )}
      </div>

      {/* New Collection Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setNewName("");
        }}
        title="New Collection"
        footer={
          <>
            <button
              onClick={() => {
                setShowNewModal(false);
                setNewName("");
              }}
              className="px-4 py-2 text-sm font-medium text-clay-600 dark:text-clay-400 hover:text-clay-800 dark:hover:text-clay-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || isCreating}
              className="px-4 py-2 text-sm font-medium bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </>
        }
      >
        <Input
          tone="terracotta"
          placeholder="Collection name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
      </Modal>

      {isLoading ? (
          <div className="text-center py-12">
            <Spinner size="md" layout="inline" className="mx-auto mb-4" />
            <p className="text-clay-500 dark:text-clay-400">
              Loading collections...
            </p>
          </div>
        ) : collections.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={<Palette size="2xl" strokeWidth={1.5} />}
            title="No collections yet"
            description="Create a collection, then fill it three ways: pick from the glaze grid, the combo grid, or swipe through Discover."
            action={
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors"
              >
                <Plus />
                New collection
              </button>
            }
          />
        ) : (
          <div className="space-y-3 xsl:space-y-0 xsl:grid xsl:grid-cols-2 sm:grid sm:grid-cols-2 sm:space-y-0 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {collections.map((collection) => {
              const images = getCollectionImages(collection);
              const glazeCount = collection.likes.filter(
                (l) => l.type === "glaze",
              ).length;
              const comboCount = collection.likes.filter(
                (l) => l.type === "combination",
              ).length;

              return (
                <button
                  key={collection.id}
                  onClick={() => navigate(`/collections/${collection.id}`)}
                  className="group w-full text-left bg-white dark:bg-earth-800 rounded-xl border border-clay-200 dark:border-earth-700 overflow-hidden hover:border-terracotta-300 dark:hover:border-terracotta-600 transition-colors p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-3">
                    {/* Header row: name + counts + chevron. */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-clay-800 dark:text-clay-100 text-base truncate group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 transition-colors">
                          {collection.name}
                        </h3>
                        <p className="text-sm text-clay-500 dark:text-clay-400 mt-0.5">
                          {collection.likes.length === 0
                            ? "Empty"
                            : [
                                glazeCount > 0 &&
                                  `${glazeCount} glaze${glazeCount !== 1 ? "s" : ""}`,
                                comboCount > 0 &&
                                  `${comboCount} combo${comboCount !== 1 ? "s" : ""}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                      </div>
                      <ChevronRight
                        size="lg"
                        className="text-clay-400 group-hover:text-terracotta-500 transition-colors shrink-0 mt-0.5"
                      />
                    </div>

                    {/* Photo strip. 3 squares fill the row width, each at
                        ~aspect-square so the visual peek is meaningful
                        rather than a 40px crop. Falls back to a soft
                        placeholder when the collection is empty. */}
                    {images.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="aspect-square rounded-md overflow-hidden bg-clay-100 dark:bg-earth-700"
                          >
                            {images[i] ? (
                              <img
                                src={images[i]}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="aspect-[3/1] rounded-md bg-clay-50 dark:bg-earth-700/50 flex items-center justify-center text-clay-300 dark:text-earth-600">
                        <Photo size="xl" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
    </PageLayout>
  );
}
