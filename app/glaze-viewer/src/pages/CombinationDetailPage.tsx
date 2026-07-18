/**
 * Combination Detail Page
 * Shows full details of a glaze combination
 */

import { useEffect, useRef, useState } from "react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  useCombination,
  useCombinationsForGlaze,
  useGlaze,
  useMyGlazes,
  useToggleGlazeOwned,
  useToggleGlazeFavorite,
  useToggleCombinationFavorite,
} from "../hooks/useGlazeData";
import { useAuth } from "../hooks/useAuth";
import { deleteUpload } from "../api/uploadsApi";
import { getPrimaryImage, prefixCdnUrl } from "../utils/glazeUtils";
import { springs } from "../config/animations";
import { imageMorphId, useImageMorph } from "../lib/imageMorph";
import { AddToContainerModal } from "../components/AddToContainerModal";
import { EntryPaginator } from "../components/EntryPaginator";
import { Spinner } from "../components/Spinner";
import { ConfirmAction } from "../components/ConfirmAction";
import { PageLayout } from "../components/PageLayout";
import { ImageLightbox } from "../components/ImageLightbox";
import {
  Badge,
  Check,
  ChevronDown,
  ChevronUp,
  Expand,
  Folder,
  Heart,
  Pencil,
  Plus,
  Pottery,
  Trash,
} from "../components/Icons";

export function CombinationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  const { data: combination, isLoading, error } = useCombination(id ?? "");
  // Shared-element morph target: the hero photo morphs out of the combination
  // card cover that was clicked. `ready` gates the effect until the hero renders
  // (after the query resolves) so it measures its true landing rect.
  const heroMorphRef = useImageMorph(
    imageMorphId("combination", id ?? ""),
    !isLoading && !!combination,
    true, // detail hero: offer its rect as the reverse-morph source on back
  );
  const myGlazes = useMyGlazes();
  const toggleOwned = useToggleGlazeOwned();
  const toggleFavorite = useToggleGlazeFavorite();
  const toggleCombinationFavorite = useToggleCombinationFavorite();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAddToCollectionOpen, setIsAddToCollectionOpen] = useState(false);
  const [isAddToPieceOpen, setIsAddToPieceOpen] = useState(false);
  const addToCollectionTriggerRef = useRef<HTMLButtonElement>(null);
  const addToPieceTriggerRef = useRef<HTMLButtonElement>(null);

  // Check if this combination is favorited
  const isCombinationFavorited =
    myGlazes.favoriteCombinations?.includes(id ?? "") ?? false;

  // Get the entry ID from URL query param
  const urlEntryId = searchParams.get("entry");

  // Select entry from URL query param (by entry ID)
  // This runs whenever combination data loads/changes
  useEffect(() => {
    if (!combination?.entries?.length) return;

    if (urlEntryId) {
      const index = combination.entries.findIndex((e) => e.id === urlEntryId);
      if (index !== -1) {
        setCurrentEntryIndex(index);
        setCurrentPhotoIndex(0); // Reset photo index when entry changes
        return;
      }
    }
    // No entry param or entry not found, default to first entry
    setCurrentEntryIndex(0);
    setCurrentPhotoIndex(0);
  }, [id, urlEntryId, combination?.entries?.length, combination?.entries]);

  // Reset photo index when entry changes
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentEntryIndex]);

  // Fullscreen keyboard handling lives inside <ImageLightbox>.

  // Get related combinations (same glazes)
  const { data: topGlazeRelated } = useCombinationsForGlaze(
    combination?.topGlaze.glazeId ?? "",
  );
  const { data: bottomGlazeRelated } = useCombinationsForGlaze(
    combination?.bottomGlaze.glazeId ?? "",
  );

  // Fetch actual glaze data for images
  const { data: topGlazeData } = useGlaze(combination?.topGlaze.glazeId ?? "");
  const { data: bottomGlazeData } = useGlaze(
    combination?.bottomGlaze.glazeId ?? "",
  );
  const topGlazeImage = topGlazeData ? getPrimaryImage(topGlazeData) : null;
  const bottomGlazeImage = bottomGlazeData
    ? getPrimaryImage(bottomGlazeData)
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-clay-50 dark:bg-earth-900 flex items-center justify-center">
        <Spinner layout="inline" />
      </div>
    );
  }

  if (error || !combination) {
    return (
      <div className="min-h-screen bg-clay-50 dark:bg-earth-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-100 mb-2">
            Combination not found
          </h1>
          <p className="text-clay-600 dark:text-clay-400 mb-4">
            The combination you're looking for doesn't exist.
          </p>
          <Link
            to="/"
            className="text-moss-600 dark:text-moss-400 hover:underline font-medium"
          >
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  const entries = combination.entries || [];
  const currentEntry = entries[currentEntryIndex];

  // Derive display values
  const displayName = `${combination.topGlaze.displayName} over ${combination.bottomGlaze.displayName}`;

  const hasOfficialEntry = entries.some((e) => e.isOfficial);

  // Handle delete for a specific entry
  const handleDeleteEntry = async (entryId: string) => {
    setIsDeleting(true);
    try {
      await deleteUpload(entryId);
      // Invalidate combinations cache
      await queryClient.invalidateQueries({ queryKey: ["combinations"] });
      // If this was the last entry, navigate away
      if (entries.length <= 1) {
        navigate("/combinations", { state: { message: "Entry deleted" } });
      } else {
        // Reset to first entry to avoid index out of bounds
        setCurrentEntryIndex(0);
        setDeletingEntryId(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setIsDeleting(false);
      setDeletingEntryId(null);
    }
  };

  // Check if an entry can be deleted (user-uploaded entries only, by the owner)
  const canDeleteEntry = (entry: (typeof entries)[0]) => {
    // User can delete their own entries (entries have userId matching current user)
    // Official entries cannot be deleted
    if (!user || entry.isOfficial) return false;

    // Check if this entry belongs to the current user
    return entry.userId === user.uid;
  };

  const canEditEntry = (entry: (typeof entries)[0]) => {
    if (!user) return false;
    // Only user-uploaded entries (with userId) can be edited
    // Scraped/official entries don't have userId and are read-only
    if (!entry.userId) return false;
    // Admins can edit any user-uploaded entry
    if (isAdmin) return true;
    // Regular users can only edit their own entries
    return entry.userId === user.uid;
  };

  const ownsTop = myGlazes.glazes[combination.topGlaze.glazeId]?.owned ?? false;
  const ownsBottom =
    myGlazes.glazes[combination.bottomGlaze.glazeId]?.owned ?? false;
  const favTop =
    myGlazes.glazes[combination.topGlaze.glazeId]?.favorite ?? false;
  const favBottom =
    myGlazes.glazes[combination.bottomGlaze.glazeId]?.favorite ?? false;

  // Filter related combinations to exclude current
  const relatedCombinations = [
    ...(topGlazeRelated ?? []),
    ...(bottomGlazeRelated ?? []),
  ]
    .filter(
      (c, i, arr) =>
        c.id !== combination.id && arr.findIndex((x) => x.id === c.id) === i,
    )
    .slice(0, 6);

  return (
    <>
      {/* Delete Confirmation Modal */}
      {deletingEntryId && (
        <ConfirmAction
          layout="modal"
          message={
            <>
              <p className="text-base font-semibold text-clay-800 dark:text-clay-200 mb-2">
                Delete Entry?
              </p>
              <p className="text-clay-600 dark:text-clay-400">
                This will permanently delete this entry and its photo.
              </p>
            </>
          }
          confirmLabel="Delete"
          isPending={isDeleting}
          onConfirm={() => handleDeleteEntry(deletingEntryId)}
          onCancel={() => setDeletingEntryId(null)}
        />
      )}

      {/* Main content */}
      <PageLayout maxWidth="7xl" padY="6">
        {/* Title — same skeleton as GlazeDetail so the two detail pages
            have a uniform header. mb-3 to badges (tighter, related content),
            then mb-4 from badges to the next section. */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-100">
              {displayName}
            </h1>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Edit button - for user-uploaded entries */}
            {canEditEntry(currentEntry) && (
              <button
                onClick={() =>
                  navigate(`/upload?edit=${currentEntry.id}&combo=${id}`)
                }
                className="p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border bg-clay-100 text-clay-600 border-clay-300 hover:bg-moss-100 hover:border-moss-400 hover:text-moss-700 active:bg-moss-200 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-moss-900/30 dark:hover:text-moss-300 dark:active:bg-moss-900/50"
                title="Edit entry"
              >
                <Pencil size="lg" />
                <span className="hidden landscape:inline sm:inline">Edit</span>
              </button>
            )}
            {/* Delete button - for user-uploaded entries */}
            {canDeleteEntry(currentEntry) && (
              <button
                onClick={() => setDeletingEntryId(currentEntry.id)}
                className="p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border bg-clay-100 text-clay-600 border-clay-300 hover:bg-red-100 hover:border-red-400 hover:text-red-700 active:bg-red-200 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-red-900/30 dark:hover:text-red-300 dark:active:bg-red-900/50"
                title="Delete entry"
              >
                <Trash size="lg" />
                <span className="hidden landscape:inline sm:inline">
                  Delete
                </span>
              </button>
            )}
            {/* Personal state: Favorite. Combos don't have an "owned" toggle
                because ownership is derived from owning both glazes; that's
                reflected via the moss-dot badges elsewhere on this page.
                Hidden for guests \u2014 favorites are per-user. */}
            {user && (
            <button
              onClick={() => id && toggleCombinationFavorite(id)}
              className={`p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border ${
                isCombinationFavorited
                  ? "bg-terracotta-100 text-terracotta-600 border-terracotta-300 hover:bg-terracotta-200 dark:bg-terracotta-900/30 dark:text-terracotta-400 dark:border-terracotta-700 dark:hover:bg-terracotta-900/50"
                  : "bg-clay-100 text-clay-600 border-clay-300 hover:bg-clay-200 hover:border-clay-400 hover:text-clay-700 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:hover:text-clay-200 dark:active:bg-earth-500"
              }`}
              title={isCombinationFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart size="lg" filled={isCombinationFavorited} />
              <span className="hidden landscape:inline sm:inline">
                {isCombinationFavorited ? "Favorited" : "Favorite"}
              </span>
            </button>
            )}
            {/* Send-to-container actions \u2014 both require a signed-in user. */}
            {user && (
            <button
              ref={addToCollectionTriggerRef}
              onClick={() => setIsAddToCollectionOpen(true)}
              className="p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border bg-clay-100 text-clay-600 border-clay-300 hover:bg-clay-200 hover:border-clay-400 hover:text-clay-700 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:hover:text-clay-200 dark:active:bg-earth-500"
              title="Add to a collection"
            >
              <Folder size="lg" />
              <span className="hidden landscape:inline sm:inline">Add to collection</span>
            </button>
            )}
            {user && (
            <button
              ref={addToPieceTriggerRef}
              onClick={() => setIsAddToPieceOpen(true)}
              className="p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border bg-clay-100 text-clay-600 border-clay-300 hover:bg-clay-200 hover:border-clay-400 hover:text-clay-700 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:hover:text-clay-200 dark:active:bg-earth-500"
              title="Add as inspo to a piece"
            >
              <Pottery size="lg" />
              <span className="hidden landscape:inline sm:inline">Add to piece</span>
            </button>
            )}
          </div>
        </div>

        {/* Badges */}
        {(hasOfficialEntry || (ownsTop && ownsBottom)) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {hasOfficialEntry && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sage-100 text-sage-700 dark:bg-sage-900 dark:text-sage-200">
                <Badge size="sm" />
                Official Test Available
              </span>
            )}
            {ownsTop && ownsBottom && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-moss-100 text-moss-700 dark:bg-moss-900 dark:text-moss-200">
                ✓ You can make this!
              </span>
            )}
          </div>
        )}

        {/* Current Entry View - Paginated */}
        {entries.length > 0 &&
          currentEntry &&
          (() => {
            return (
              <div className="mb-4">
                {/* Entry navigation */}
                <EntryPaginator
                  currentIndex={currentEntryIndex}
                  total={entries.length}
                  label="Entry"
                  onPrev={() =>
                    setCurrentEntryIndex((i) =>
                      i === 0 ? entries.length - 1 : i - 1,
                    )
                  }
                  onNext={() =>
                    setCurrentEntryIndex((i) =>
                      i === entries.length - 1 ? 0 : i + 1,
                    )
                  }
                />

                {/* Main layout - photo on left, details on right. On mobile landscape, use row layout */}
                <div className="flex flex-col landscape:flex-row md:flex-row gap-6">
                  {/* Photo column - constrain height on mobile landscape, 1/3 width in landscape */}
                  <div className="md:w-80 landscape:w-1/3 flex-shrink-0">
                    <div
                      ref={heroMorphRef}
                      className="relative bg-white dark:bg-earth-800 rounded-xl shadow-sm border-2 border-sage-100 dark:border-earth-600 overflow-hidden"
                    >
                      {currentEntry.photos?.[currentPhotoIndex] ? (
                        <div
                          className="aspect-square relative max-h-[60vh] landscape:max-h-[70vh] md:max-h-none cursor-pointer"
                          onClick={() => setIsFullscreen(true)}
                        >
                          <img
                            src={prefixCdnUrl(currentEntry.photos[currentPhotoIndex].url)}
                            alt={`${displayName} - Entry ${currentEntryIndex + 1}, Photo ${currentPhotoIndex + 1}`}
                            decoding="async"
                            className="w-full h-full object-cover"
                          />

                          {/* Official badge */}
                          {currentEntry.isOfficial && (
                            <div className="absolute top-2 left-2">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-sage-500 text-white shadow">
                                Official
                              </span>
                            </div>
                          )}

                          {/* Expand icon */}
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsFullscreen(true);
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            transition={springs.quick}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                          >
                            <Expand />
                          </motion.button>

                          {/* Photo counter for multiple photos */}
                          {currentEntry.photos.length > 1 && (
                            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
                              {currentPhotoIndex + 1} /{" "}
                              {currentEntry.photos.length}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square bg-clay-100 dark:bg-earth-700 flex items-center justify-center">
                          <span className="text-clay-400 dark:text-earth-500">
                            No photo
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Thumbnail strip for multiple photos */}
                    {currentEntry.photos && currentEntry.photos.length > 1 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {currentEntry.photos.map((photo, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentPhotoIndex(idx)}
                            className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                              idx === currentPhotoIndex
                                ? "border-terracotta-500 ring-2 ring-terracotta-300"
                                : "border-clay-200 dark:border-earth-600 hover:border-clay-400 dark:hover:border-earth-400"
                            }`}
                          >
                            <img
                              src={prefixCdnUrl(photo.url)}
                              alt={`Thumbnail ${idx + 1}`}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Details column */}
                  <div className="flex-1 space-y-4">
                    {/* Firing Information */}
                    <div className="bg-white dark:bg-earth-800 rounded-xl p-4 shadow-sm border-2 border-sage-100 dark:border-earth-600">
                      <h3 className="font-semibold text-clay-800 dark:text-clay-100 mb-3">
                        Firing Information
                      </h3>
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-clay-600 dark:text-clay-400">
                            Cone
                          </dt>
                          <dd className="font-medium text-clay-800 dark:text-clay-200">
                            {currentEntry.cone}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-clay-600 dark:text-clay-400">
                            Clay Body
                          </dt>
                          <dd className="font-medium text-clay-800 dark:text-clay-200">
                            {currentEntry.clayBody ?? "Not specified"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-clay-600 dark:text-clay-400">
                            Submitted By
                          </dt>
                          <dd className="font-medium text-clay-800 dark:text-clay-200">
                            {currentEntry.isOfficial ? (
                              currentEntry.submittedBy
                            ) : currentEntry.userId ? (
                              <Link
                                to={`/user/${currentEntry.userId}`}
                                className="text-terracotta-600 dark:text-terracotta-400 hover:underline"
                              >
                                {currentEntry.userId === user?.uid
                                  ? "You"
                                  : `User ${currentEntry.userId.slice(0, 8)}`}
                              </Link>
                            ) : (
                              currentEntry.submittedBy
                            )}
                          </dd>
                        </div>
                      </dl>

                      {/* Notes */}
                      {currentEntry.notes && (
                        <div className="mt-3 pt-3 border-t border-clay-200 dark:border-earth-600">
                          <p className="text-sm text-clay-600 dark:text-clay-400">
                            <span className="font-medium text-clay-700 dark:text-clay-300">
                              Notes:
                            </span>{" "}
                            {currentEntry.notes}
                          </p>
                        </div>
                      )}

                      {/* Tags - entry tags for all entries, AI characteristics only for scraped entries (no userId) */}
                      {((currentEntry.tags && currentEntry.tags.length > 0) ||
                        (!currentEntry.userId &&
                          (combination.ai?.colors?.length ||
                            combination.ai?.effects?.length ||
                            combination.ai?.finish ||
                            combination.ai?.style))) && (
                        <div className="mt-3 pt-3 border-t border-clay-200 dark:border-earth-600">
                          <div className="flex flex-wrap gap-2">
                            {/* Entry tags */}
                            {currentEntry.tags?.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-1 rounded-full bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300 text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                            {/* AI characteristics - only for scraped entries (no userId) */}
                            {!currentEntry.userId &&
                              combination.ai?.colors?.map((color) => (
                                <span
                                  key={`ai-${color}`}
                                  className="px-2.5 py-1 rounded-full bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300 text-xs font-medium"
                                >
                                  {color}
                                </span>
                              ))}
                            {!currentEntry.userId && combination.ai?.finish && (
                              <span className="px-2.5 py-1 rounded-full bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300 text-xs font-medium">
                                {combination.ai.finish}
                              </span>
                            )}
                            {!currentEntry.userId && combination.ai?.style && (
                              <span className="px-2.5 py-1 rounded-full bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300 text-xs font-medium">
                                {combination.ai.style}
                              </span>
                            )}
                            {!currentEntry.userId &&
                              combination.ai?.effects?.map((effect) => (
                                <span
                                  key={`ai-${effect}`}
                                  className="px-2.5 py-1 rounded-full bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300 text-xs font-medium"
                                >
                                  {effect}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Top Glaze */}
                    <div className="bg-white dark:bg-earth-800 rounded-xl p-4 shadow-sm border-2 border-sage-100 dark:border-earth-600">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {topGlazeImage && (
                            <Link
                              to={`/glaze/${combination.topGlaze.glazeId}`}
                              className="flex-shrink-0"
                            >
                              <img
                                src={topGlazeImage}
                                alt={combination.topGlaze.displayName}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            </Link>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-moss-600 dark:text-moss-400 uppercase tracking-wider flex items-center gap-1">
                              <ChevronUp size="xs" />
                              Top Coat • {currentEntry.topCoats} coat
                              {currentEntry.topCoats !== 1 ? "s" : ""}
                            </span>
                            <Link
                              to={`/glaze/${combination.topGlaze.glazeId}`}
                              className="block hover:text-terracotta-600 dark:hover:text-terracotta-400"
                            >
                              <h4 className="text-base font-semibold text-clay-800 dark:text-clay-100 mt-1 hover:underline line-clamp-2">
                                {combination.topGlaze.displayName}
                              </h4>
                            </Link>
                          </div>
                        </div>
                        {(user || isAdmin) && (
                        <div className="flex flex-col gap-1">
                          {user && (
                          <button
                            onClick={() =>
                              toggleFavorite(combination.topGlaze.glazeId)
                            }
                            className={`p-2 rounded-lg transition-colors border ${
                              favTop
                                ? "bg-terracotta-100 text-terracotta-600 border-terracotta-400 dark:bg-terracotta-900 dark:text-terracotta-400"
                                : "bg-clay-100 text-clay-400 border-clay-300 hover:bg-terracotta-100 hover:border-terracotta-400 hover:text-terracotta-600 dark:bg-earth-700 dark:border-earth-500"
                            }`}
                            title={
                              favTop
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                          >
                            <Heart filled={favTop} />
                          </button>
                          )}
                          {isAdmin && (
                          <button
                            onClick={() =>
                              toggleOwned(combination.topGlaze.glazeId)
                            }
                            className={`p-2 rounded-lg transition-colors border ${
                              ownsTop
                                ? "bg-moss-100 text-moss-600 border-moss-400 dark:bg-moss-900 dark:text-moss-400"
                                : "bg-clay-100 text-clay-400 border-clay-300 hover:bg-moss-100 hover:border-moss-400 hover:text-moss-600 dark:bg-earth-700 dark:border-earth-500"
                            }`}
                            title={
                              ownsTop ? "Remove from inventory" : "Add to inventory"
                            }
                          >
                            <Check />
                          </button>
                          )}
                        </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Glaze */}
                    <div className="bg-white dark:bg-earth-800 rounded-xl p-4 shadow-sm border-2 border-sage-100 dark:border-earth-600">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {bottomGlazeImage && (
                            <Link
                              to={`/glaze/${combination.bottomGlaze.glazeId}`}
                              className="flex-shrink-0"
                            >
                              <img
                                src={bottomGlazeImage}
                                alt={combination.bottomGlaze.displayName}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            </Link>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-terracotta-500 dark:text-terracotta-400 uppercase tracking-wider flex items-center gap-1">
                              <ChevronDown size="xs" />
                              Bottom Coat • {currentEntry.bottomCoats} coat
                              {currentEntry.bottomCoats !== 1 ? "s" : ""}
                            </span>
                            <Link
                              to={`/glaze/${combination.bottomGlaze.glazeId}`}
                              className="block hover:text-terracotta-600 dark:hover:text-terracotta-400"
                            >
                              <h4 className="text-base font-semibold text-clay-800 dark:text-clay-100 mt-1 hover:underline line-clamp-2">
                                {combination.bottomGlaze.displayName}
                              </h4>
                            </Link>
                          </div>
                        </div>
                        {(user || isAdmin) && (
                        <div className="flex flex-col gap-1">
                          {user && (
                          <button
                            onClick={() =>
                              toggleFavorite(combination.bottomGlaze.glazeId)
                            }
                            className={`p-2 rounded-lg transition-colors border ${
                              favBottom
                                ? "bg-terracotta-100 text-terracotta-600 border-terracotta-400 dark:bg-terracotta-900 dark:text-terracotta-400"
                                : "bg-clay-100 text-clay-400 border-clay-300 hover:bg-terracotta-100 hover:border-terracotta-400 hover:text-terracotta-600 dark:bg-earth-700 dark:border-earth-500"
                            }`}
                            title={
                              favBottom
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                          >
                            <Heart filled={favBottom} />
                          </button>
                          )}
                          {isAdmin && (
                          <button
                            onClick={() =>
                              toggleOwned(combination.bottomGlaze.glazeId)
                            }
                            className={`p-2 rounded-lg transition-colors border ${
                              ownsBottom
                                ? "bg-moss-100 text-moss-600 border-moss-400 dark:bg-moss-900 dark:text-moss-400"
                                : "bg-clay-100 text-clay-400 border-clay-300 hover:bg-moss-100 hover:border-moss-400 hover:text-moss-600 dark:bg-earth-700 dark:border-earth-500"
                            }`}
                            title={
                              ownsBottom ? "Remove from inventory" : "Add to inventory"
                            }
                          >
                            <Check />
                          </button>
                          )}
                        </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Add Entry Button */}
        {user && (
          <div className="mb-4">
            <Link
              to={`/upload?top=${combination.topGlaze.glazeId}&bottom=${combination.bottomGlaze.glazeId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 hover:border-terracotta-400 hover:text-terracotta-600 dark:hover:border-terracotta-500 dark:hover:text-terracotta-400 transition-colors"
            >
              <Plus size="lg" />
              Add Your Entry
            </Link>
          </div>
        )}

        {/* Tags */}
        {(combination.tags?.length ?? 0) > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {combination.tags!.map((tag) => (
                <Link
                  key={tag}
                  to={`/?tags=${tag}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-sage-50 text-sage-700 border border-sage-200 hover:bg-sage-100 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related Combinations */}
        {relatedCombinations.length > 0 && (
          <div className="pt-4 border-t border-clay-200 dark:border-earth-600">
            <h3 className="text-xl font-bold text-clay-800 dark:text-clay-100 mb-3">
              Related Combinations
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedCombinations.map((related) => {
                const relatedPhotos =
                  related.entries?.flatMap((e) => e.photos) ?? [];
                const photo =
                  relatedPhotos.find((p) => p.isCover) ?? relatedPhotos[0];
                const relatedDisplayName =
                  related.displayName ??
                  `${related.topGlaze.displayName} over ${related.bottomGlaze.displayName}`;
                return (
                  <Link
                    key={related.id}
                    to={`/combination/${related.id}`}
                    className="group block bg-white dark:bg-earth-800 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden border-2 border-sage-100 dark:border-earth-600 hover:border-sage-300 dark:hover:border-sage-700"
                  >
                    <div className="aspect-square bg-clay-100 dark:bg-earth-700">
                      {photo ? (
                        <img
                          src={prefixCdnUrl(photo.url)}
                          alt={relatedDisplayName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500 text-xs">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-clay-700 dark:text-clay-300 line-clamp-2">
                        {relatedDisplayName}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Fullscreen Modal */}
        {(() => {
          const currentEntry = combination?.entries?.[currentEntryIndex];
          const photos = currentEntry?.photos;
          const imageUrl = photos?.[currentPhotoIndex]?.url;
          const fullImageUrl = imageUrl ? prefixCdnUrl(imageUrl) : null;
          const hasMany = (photos?.length ?? 0) > 1;
          return (
            <ImageLightbox
              src={fullImageUrl}
              alt={displayName}
              isOpen={isFullscreen && !!fullImageUrl}
              onClose={() => setIsFullscreen(false)}
              onPrev={
                hasMany
                  ? () =>
                      setCurrentPhotoIndex((i) =>
                        i === 0 ? photos!.length - 1 : i - 1,
                      )
                  : undefined
              }
              onNext={
                hasMany
                  ? () =>
                      setCurrentPhotoIndex((i) =>
                        i === photos!.length - 1 ? 0 : i + 1,
                      )
                  : undefined
              }
              footer={
                hasMany
                  ? `${currentPhotoIndex + 1} / ${photos!.length}`
                  : undefined
              }
            />
          );
        })()}

        {/* Add to Collection / Piece */}
        <AddToContainerModal
          kind="collection"
          isOpen={isAddToCollectionOpen}
          onClose={() => setIsAddToCollectionOpen(false)}
          itemType="combination"
          itemId={combination.id}
          itemName={displayName}
          triggerRef={addToCollectionTriggerRef}
        />
        <AddToContainerModal
          kind="piece"
          isOpen={isAddToPieceOpen}
          onClose={() => setIsAddToPieceOpen(false)}
          itemType="combination"
          itemId={combination.id}
          itemName={displayName}
          triggerRef={addToPieceTriggerRef}
        />
      </PageLayout>
    </>
  );
}
