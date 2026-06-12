/**
 * Discover "results" view after the user has finished (or paused) swiping.
 *
 * Renders the saved-picks header, the inline save-to-collection bar (which
 * supports either "new" or "add to existing"), and grids of picked glazes /
 * combinations. Pure presentation — DiscoverPage owns the like list, the
 * mode toggle state, and the save handler.
 */

import { useNavigate } from "react-router-dom";
import type {
  Collection,
  CollectionItem,
  Glaze,
  GlazeCombination,
} from "../../types/models";
import {
  getCombinationImage,
  getPrimaryImage,
} from "../../utils/glazeUtils";
import { Palette } from "../Icons";
import { Select } from "../Select";

interface ResultsViewProps {
  likes: CollectionItem[];
  glazes: Glaze[];
  combinations: GlazeCombination[];
  collectionName: string;
  setCollectionName: (name: string) => void;
  savedCollections: Collection[];
  addToCollectionId: string | null;
  setAddToCollectionId: (id: string | null) => void;
  onSave: () => void;
  onContinue: () => void;
  onBack: () => void;
  isComplete: boolean;
  editingCollectionId: string | null;
  hasMoreItems: boolean;
}

export function ResultsView({
  likes,
  glazes,
  combinations,
  collectionName,
  setCollectionName,
  savedCollections,
  addToCollectionId,
  setAddToCollectionId,
  onSave,
  onContinue,
  // onBack is currently unused but kept so the parent's API doesn't shift
  // when we re-enable the explicit back button.
  onBack: _onBack,
  isComplete,
  editingCollectionId,
  hasMoreItems,
}: ResultsViewProps) {
  void _onBack;
  const isEditing = !!editingCollectionId;
  const navigate = useNavigate();

  const likedGlazes = likes
    .filter((l) => l.type === "glaze")
    .map((l) => glazes.find((g) => g.id === l.id))
    .filter(Boolean) as Glaze[];

  const likedCombinations = likes
    .filter((l) => l.type === "combination")
    .map((l) => combinations.find((c) => c.id === l.id))
    .filter(Boolean) as GlazeCombination[];

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-8">
      {/* Header */}
      <div className="px-4 py-3 border-b border-clay-200 dark:border-earth-700 sticky top-0 bg-white dark:bg-earth-800 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-clay-800 dark:text-clay-200">
            {isComplete && !hasMoreItems ? "All Done!" : "Your Picks"}
          </h1>
          {hasMoreItems && (
            <button
              onClick={onContinue}
              className="text-sm text-terracotta-600 dark:text-terracotta-400 hover:underline"
            >
              Continue Selecting
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Collection info when editing */}
        {isEditing && collectionName && (
          <div className="mb-6 p-4 bg-moss-50 dark:bg-moss-900/20 rounded-xl border border-moss-200 dark:border-moss-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-moss-600 dark:text-moss-400 uppercase tracking-wider mb-1">
                  Collection
                </p>
                <p className="font-semibold text-clay-800 dark:text-clay-200">
                  {collectionName}
                </p>
              </div>
              <button
                onClick={() => navigate(`/collections/${editingCollectionId}`)}
                className="px-3 py-1.5 text-sm font-medium text-moss-700 dark:text-moss-300 bg-moss-100 dark:bg-moss-900/50 rounded-lg hover:bg-moss-200 dark:hover:bg-moss-800/50 transition-colors"
              >
                View Collection
              </button>
            </div>
            <p className="text-xs text-moss-600 dark:text-moss-400 mt-2">
              Changes are saved automatically
            </p>
          </div>
        )}

        {/* Save as collection - only show when NOT editing (editing auto-saves) */}
        {likes.length > 0 && !isEditing && (
          <div className="mb-6 p-4 bg-clay-50 dark:bg-earth-800 rounded-xl border border-clay-200 dark:border-earth-700">
            <h2 className="text-sm font-semibold text-clay-700 dark:text-clay-300 mb-3">
              Save your picks
            </h2>

            {/* Mode toggle — only show when at least one collection exists */}
            {savedCollections.length > 0 && (
              <div className="flex gap-2 mb-3 text-xs">
                <button
                  type="button"
                  onClick={() => setAddToCollectionId(null)}
                  className={`flex-1 px-3 py-1.5 rounded-lg border transition-colors ${
                    addToCollectionId === null
                      ? "bg-terracotta-500 text-white border-terracotta-600"
                      : "bg-white dark:bg-earth-700 text-clay-600 dark:text-clay-300 border-clay-300 dark:border-earth-600 hover:bg-clay-50 dark:hover:bg-earth-600"
                  }`}
                >
                  New collection
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAddToCollectionId(savedCollections[0]?.id ?? null)
                  }
                  className={`flex-1 px-3 py-1.5 rounded-lg border transition-colors ${
                    addToCollectionId !== null
                      ? "bg-terracotta-500 text-white border-terracotta-600"
                      : "bg-white dark:bg-earth-700 text-clay-600 dark:text-clay-300 border-clay-300 dark:border-earth-600 hover:bg-clay-50 dark:hover:bg-earth-600"
                  }`}
                >
                  Add to existing
                </button>
              </div>
            )}

            <div className="flex gap-2">
              {addToCollectionId !== null ? (
                <Select
                  value={addToCollectionId}
                  onChange={(e) => setAddToCollectionId(e.target.value)}
                  fullWidth
                  tone="terracotta"
                  ariaLabel="Choose a collection to add to"
                  searchable={savedCollections.length > 8}
                  className="flex-1"
                >
                  {savedCollections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.likes.length})
                    </option>
                  ))}
                </Select>
              ) : (
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="e.g., Large Bowl, Tea Set..."
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-earth-700 border border-clay-300 dark:border-earth-600 rounded-lg text-clay-800 dark:text-clay-200 placeholder-clay-400 dark:placeholder-clay-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              )}
              <button
                onClick={onSave}
                disabled={
                  addToCollectionId === null ? !collectionName.trim() : false
                }
                className="px-4 py-2 text-sm font-medium bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addToCollectionId === null ? "Save" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 flex gap-4 text-center">
          <div className="flex-1">
            <p className="text-3xl font-bold text-moss-600 dark:text-moss-400">
              {likedGlazes.length}
            </p>
            <p className="text-sm text-clay-500 dark:text-clay-400">Glazes</p>
          </div>
          <div className="flex-1">
            <p className="text-3xl font-bold text-terracotta-600 dark:text-terracotta-400">
              {likedCombinations.length}
            </p>
            <p className="text-sm text-clay-500 dark:text-clay-400">
              Combinations
            </p>
          </div>
        </div>

        {/* Picked glazes */}
        {likedGlazes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-3">
              Picked Glazes
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {likedGlazes.map((glaze) => (
                <button
                  key={glaze.id}
                  onClick={() =>
                    navigate(`/glaze/${glaze.id}`, {
                      state: { fromCollection: editingCollectionId },
                      replace: !!editingCollectionId,
                    })
                  }
                  className="group bg-white dark:bg-earth-800 rounded-lg overflow-hidden border border-clay-200 dark:border-earth-700 hover:border-terracotta-400 dark:hover:border-terracotta-500 transition-colors text-left"
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
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Picked combinations */}
        {likedCombinations.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-3">
              Picked Combinations
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {likedCombinations.map((combo) => (
                <button
                  key={combo.id}
                  onClick={() =>
                    navigate(`/combination/${combo.id}`, {
                      state: { fromCollection: editingCollectionId },
                      replace: !!editingCollectionId,
                    })
                  }
                  className="group bg-white dark:bg-earth-800 rounded-lg overflow-hidden border border-clay-200 dark:border-earth-700 hover:border-terracotta-400 dark:hover:border-terracotta-500 transition-colors text-left"
                >
                  <div className="aspect-square bg-clay-100 dark:bg-earth-700">
                    {getCombinationImage(combo) ? (
                      <img
                        src={getCombinationImage(combo) || ""}
                        alt={combo.displayName}
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
                      {combo.topGlaze.displayName}
                    </p>
                    <p className="text-xs text-clay-500 dark:text-clay-400 truncate">
                      over {combo.bottomGlaze.displayName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {likes.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-clay-100 dark:bg-earth-700 flex items-center justify-center">
              <Palette size="2xl" tone="muted" strokeWidth={1.5} />
            </div>
            <p className="text-clay-600 dark:text-clay-400">
              No picks yet! Swipe right on items you want to use.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
