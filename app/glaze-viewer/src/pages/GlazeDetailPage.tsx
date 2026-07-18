import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  useGlaze,
  useMyGlazes,
  useToggleGlazeOwned,
  useToggleGlazeFavorite,
  useCombinations,
  useUserGlazeResults,
} from "../hooks/useGlazeData";
import { useAuth } from "../hooks/useAuth";
import { deleteUpload } from "../api/uploadsApi";
import { getPrimaryImage, getImageUrl, prefixCdnUrl } from "../utils/glazeUtils";
import { springs } from "../config/animations";
import { imageMorphId, useImageMorph } from "../lib/imageMorph";
import { AddToContainerModal } from "../components/AddToContainerModal";
import { CombinationCard } from "../components/CombinationCard";
import { ConfirmAction } from "../components/ConfirmAction";
import { EntryPaginator } from "../components/EntryPaginator";
import { ImageLightbox } from "../components/ImageLightbox";
import { Spinner } from "../components/Spinner";
import { PageLayout } from "../components/PageLayout";
import {
  Document,
  Expand,
  Folder,
  Heart,
  Inventory,
  Pottery,
  Tag,
} from "../components/Icons";
import type { GlazeImage } from "../types/models";

export function GlazeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: glaze, isLoading, error } = useGlaze(id || "");
  // Shared-element morph target: the hero photo morphs out of the glaze card
  // thumbnail that was clicked. `ready` gates the effect until the hero renders
  // (after the query resolves) so it measures its true landing rect.
  const heroMorphRef = useImageMorph(
    imageMorphId("glaze", id ?? ""),
    !isLoading && !!glaze,
    true, // detail hero: offer its rect as the reverse-morph source on back
  );
  const [selectedImage, setSelectedImage] = useState<GlazeImage | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const myGlazes = useMyGlazes();
  const toggleOwned = useToggleGlazeOwned();
  const toggleFavorite = useToggleGlazeFavorite();

  const isOwned = id ? (myGlazes.glazes[id]?.owned ?? false) : false;
  const isFavorite = id ? (myGlazes.glazes[id]?.favorite ?? false) : false;
  const [isAddToCollectionOpen, setIsAddToCollectionOpen] = useState(false);
  const [isAddToPieceOpen, setIsAddToPieceOpen] = useState(false);
  const addToCollectionTriggerRef = useRef<HTMLButtonElement>(null);
  const addToPieceTriggerRef = useRef<HTMLButtonElement>(null);
  const [deletingResultId, setDeletingResultId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Paginated entry viewer (mirrors CombinationDetailPage).
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [currentResultPhotoIndex, setCurrentResultPhotoIndex] = useState(0);
  const { data: allCombinations = [] } = useCombinations();
  const { data: singleGlazeResults = [] } = useUserGlazeResults(id);

  // Only consider results that have at least one photo so the pagination
  // index can't land on something with nothing to show.
  const resultsWithPhotos = useMemo(
    () => singleGlazeResults.filter((r) => r.imageUrls.length > 0),
    [singleGlazeResults],
  );
  const currentResult = resultsWithPhotos[currentResultIndex];

  // Scroll anchor for post-upload navigation with `?entry=`.
  const communityResultsRef = useRef<HTMLDivElement>(null);

  // Sync paginator to the URL `?entry=` so post-upload navigation lands on
  // the just-shared result (and scrolls it into view).
  const urlEntryId = searchParams.get("entry");
  useEffect(() => {
    if (!resultsWithPhotos.length) {
      setCurrentResultIndex(0);
      setCurrentResultPhotoIndex(0);
      return;
    }
    if (urlEntryId) {
      const index = resultsWithPhotos.findIndex((r) => r.id === urlEntryId);
      if (index !== -1) {
        setCurrentResultIndex(index);
        setCurrentResultPhotoIndex(0);
        communityResultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
    }
    setCurrentResultIndex(0);
    setCurrentResultPhotoIndex(0);
  }, [id, urlEntryId, resultsWithPhotos]);
  useEffect(() => {
    setCurrentResultPhotoIndex(0);
  }, [currentResultIndex]);

  // Owner check for inline edit/delete on Community Results cards.
  const canManageResult = (resultUserId: string) =>
    !!user && (isAdmin || user.uid === resultUserId);

  const handleDeleteResult = async (resultId: string) => {
    setIsDeleting(true);
    try {
      await deleteUpload(resultId);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["userGlazeResults"] }),
        queryClient.refetchQueries({ queryKey: ["uploads"] }),
        queryClient.refetchQueries({ queryKey: ["combinations"] }),
      ]);
    } catch (err) {
      console.error("Failed to delete result:", err);
    } finally {
      setIsDeleting(false);
      setDeletingResultId(null);
    }
  };

  // Community combinations: combos that include this glaze and have at
  // least one non-official user entry with photos. We dedupe at the combo
  // level so each combo renders as a single card regardless of how many
  // user entries it has — the CombinationCard handles entry counts itself.
  const communityCombinations = allCombinations.filter(
    (c) =>
      (c.topGlaze?.glazeId === id || c.bottomGlaze?.glazeId === id) &&
      c.entries.some((e) => !e.isOfficial && e.photos.length > 0),
  );

  // Fullscreen keyboard handling lives inside <ImageLightbox>.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner layout="inline" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-terracotta-600">Error loading glaze data</div>
      </div>
    );
  }

  if (!glaze) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-clay-600 dark:text-earth-400">Glaze not found</div>
        <Link
          to="/glazes"
          className="text-moss-600 hover:text-moss-700 dark:text-moss-400 font-medium"
        >
          ← Back to Glazes
        </Link>
      </div>
    );
  }

  const primaryImage = getPrimaryImage(glaze);
  const displayImage = selectedImage
    ? getImageUrl(selectedImage)
    : primaryImage;

  return (
    <PageLayout maxWidth="7xl" padY="6">
      {/* Title and Actions */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-100">
            {glaze.displayName}
          </h1>
          <p className="text-sm text-clay-600 dark:text-clay-400">
            {glaze.brand} • {glaze.series}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Personal state. Favorite is per-user (hidden for guests).
              Inventory is shared studio state \u2014 admin only. */}
          {user && (
          <button
            onClick={() => toggleFavorite(glaze.id)}
            className={`p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border ${
              isFavorite
                ? "bg-terracotta-100 text-terracotta-700 border-terracotta-400 dark:bg-terracotta-900/50 dark:text-terracotta-300 dark:border-terracotta-600"
                : "bg-clay-100 text-clay-600 border-clay-300 hover:bg-clay-200 hover:border-clay-400 hover:text-clay-700 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:hover:text-clay-200 dark:active:bg-earth-500"
            }`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size="lg" filled={isFavorite} />
            <span className="hidden landscape:inline sm:inline">
              {isFavorite ? "Favorited" : "Favorite"}
            </span>
          </button>
          )}
          {isAdmin && (
          <button
            onClick={() => toggleOwned(glaze.id)}
            className={`p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border ${
              // Owned: saturated solid moss so the "on" state reads as
              // unambiguously selected (a subtle moss-100 tint blends into
              // the press feedback below, making toggles invisible).
              isOwned
                ? "bg-moss-500 text-white border-moss-500 hover:bg-moss-600 active:bg-moss-700 dark:bg-moss-600 dark:border-moss-600 dark:hover:bg-moss-500 dark:active:bg-moss-700"
                : "bg-clay-100 text-clay-600 border-clay-300 hover:bg-clay-200 hover:border-clay-400 hover:text-clay-700 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:active:bg-earth-500"
            }`}
            title={isOwned ? "Remove from inventory" : "Add to inventory"}
          >
            <Inventory size="lg" />
            <span className="hidden landscape:inline sm:inline">
              {isOwned ? "In inventory" : "Inventory"}
            </span>
          </button>
          )}

          {/* Send-to-container actions \u2014 both require a signed-in user
              since collections and pieces are per-user. */}
          {user && (
          <button
            ref={addToCollectionTriggerRef}
            onClick={() => setIsAddToCollectionOpen(true)}
            className="p-2 landscape:px-4 landscape:py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border bg-clay-100 text-clay-600 border-clay-300 hover:bg-clay-200 hover:border-clay-400 hover:text-clay-700 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:hover:text-clay-200 dark:active:bg-earth-500"
            title="Add to a collection"
          >
            <Folder size="lg" />
            <span className="hidden landscape:inline sm:inline">
              Add to collection
            </span>
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
            <span className="hidden landscape:inline sm:inline">
              Add to piece
            </span>
          </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 xsl:grid-cols-[auto_1fr] md:grid-cols-[minmax(200px,1fr)_2fr] lg:grid-cols-[1fr_1fr] gap-6 lg:gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          {/* Main Image */}
          <div
            ref={heroMorphRef}
            className="relative aspect-square max-h-[40vh] xs:max-h-none xsl:max-h-[55vh] max-w-[40vh] xs:max-w-none xsl:max-w-[55vh] md:max-w-none mx-auto md:mx-0 xsl:mx-0 w-full bg-white dark:bg-earth-800 rounded-xl overflow-hidden border-2 border-sage-100 dark:border-earth-600 cursor-pointer"
            onClick={() => displayImage && setIsFullscreen(true)}
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt={glaze.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-clay-200 to-clay-300 dark:from-earth-700 dark:to-earth-600">
                <span className="text-6xl font-bold text-clay-400 dark:text-earth-500">
                  {glaze.code.split("-")[0]}
                </span>
              </div>
            )}

            {/* Expand icon */}
            {displayImage && (
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(true);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={springs.quick}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors focus-ring"
              >
                <Expand />
              </motion.button>
            )}
          </div>

          {/* Thumbnail Grid with Labels */}
          {glaze.images.length > 1 && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 xs:grid-cols-6 xsl:grid-cols-6 gap-2 max-w-[40vh] xs:max-w-none xsl:max-w-[55vh] mx-auto md:mx-0 xsl:mx-0">
                {glaze.images.map((image) => {
                  const isSelected =
                    selectedImage?.id === image.id ||
                    (!selectedImage && image.isPrimary);

                  // Build label from enriched metadata or fall back to alt text
                  const labelParts: string[] = [];
                  if (image.cone) {
                    labelParts.push(`Cone ${image.cone}`);
                  }
                  if (image.atmosphere) {
                    labelParts.push(
                      image.atmosphere === "reduction" ? "red." : "ox.",
                    );
                  }
                  if (image.clayBody) {
                    labelParts.push(image.clayBody.replace("-", " "));
                  }
                  if (image.comboType && image.comboGlaze) {
                    labelParts.push(`${image.comboType} ${image.comboGlaze}`);
                  }
                  // Use alt text if no structured metadata available
                  const label =
                    labelParts.length > 0
                      ? labelParts.join(" · ")
                      : image.alt || null;

                  return (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImage(image)}
                      title={label || image.alt || glaze.displayName}
                      className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-terracotta-500 ring-2 ring-moss-500/30"
                          : "border-sage-200 dark:border-earth-600 hover:border-moss-300"
                      }`}
                    >
                      <img
                        src={getImageUrl(image)}
                        alt={image.alt || glaze.displayName}
                        className="w-full h-full object-cover"
                      />
                      {/* Hover overlay with label */}
                      {label && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                          <span className="text-[10px] text-white text-center leading-tight">
                            {label}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected image label */}
              {(() => {
                const img =
                  selectedImage ||
                  glaze.images.find((i) => i.isPrimary) ||
                  glaze.images[0];
                const hasStructuredData =
                  img?.cone || img?.clayBody || img?.comboType;
                const structuredLabel = hasStructuredData
                  ? [
                      img.cone && `Cone ${img.cone}`,
                      img.atmosphere &&
                        (img.atmosphere === "reduction"
                          ? "Reduction"
                          : "Oxidation"),
                      img.clayBody && img.clayBody.replace("-", " "),
                      img.coats && `${img.coats} coats`,
                      img.comboType &&
                        img.comboGlaze &&
                        `${img.comboType} ${img.comboGlaze}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : null;
                const label = structuredLabel || img?.alt;

                return label ? (
                  <p className="text-xs text-clay-600 dark:text-clay-400 text-center md:text-left">
                    {label}
                  </p>
                ) : null;
              })()}
            </div>
          )}

          {/* Image Count */}
          <p className="text-sm text-clay-600 dark:text-clay-400 text-center">
            {glaze.images.length} image{glaze.images.length !== 1 ? "s" : ""}{" "}
            available
          </p>
        </div>

        {/* Details Panel */}
        <div className="space-y-6">
          {/* Description */}
          {glaze.description && (
            <div className="bg-white dark:bg-earth-800 rounded-xl p-6 border-2 border-sage-100 dark:border-earth-600">
              <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100 mb-3 flex items-center gap-2">
                <Document size="lg" />
                Description
              </h2>
              <p className="text-clay-700 dark:text-clay-300 text-sm leading-relaxed">
                {glaze.description}
              </p>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-white dark:bg-earth-800 rounded-xl p-6 border-2 border-sage-100 dark:border-earth-600">
            <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100 mb-3">
              Details
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-clay-600 dark:text-clay-400">Brand</dt>
                <dd className="text-clay-800 dark:text-clay-200 font-medium">
                  {glaze.brand}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-clay-600 dark:text-clay-400">Series</dt>
                <dd className="text-clay-800 dark:text-clay-200 font-medium">
                  {glaze.series}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-clay-600 dark:text-clay-400">Code</dt>
                <dd className="text-clay-800 dark:text-clay-200 font-medium">
                  {glaze.code}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-clay-600 dark:text-clay-400">Cone</dt>
                <dd className="text-clay-800 dark:text-clay-200 font-medium">
                  {glaze.cone.join(", ")}
                </dd>
              </div>
            </dl>
          </div>

          {/* Tags */}
          {glaze.tags && glaze.tags.length > 0 && (
            <div className="bg-white dark:bg-earth-800 rounded-xl p-6 border-2 border-sage-100 dark:border-earth-600">
              <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100 mb-3 flex items-center gap-2">
                <Tag size="lg" />
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {glaze.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 rounded-full text-sm font-medium border border-sage-300 dark:border-sage-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* External Link */}
          {glaze.productUrl && (
            <a
              href={glaze.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-4 py-3 bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-medium transition-colors shadow-sm"
            >
              <span>View on {glaze.brand} Website</span>
              <span aria-hidden>→</span>
            </a>
          )}

          {/* Explore Combinations Link */}
          <Link
            to={`/glaze/${glaze.id}/combinations`}
            className="flex items-center justify-between w-full px-4 py-3 bg-terracotta-100 hover:bg-terracotta-200 text-terracotta-700 dark:bg-terracotta-900/50 dark:hover:bg-terracotta-900/70 dark:text-terracotta-300 rounded-xl font-medium transition-colors border border-terracotta-300 dark:border-terracotta-700"
          >
            <span>Explore Glaze Combinations</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      {/* Community Results — uploads of just this glaze on its own.
          Paginated viewer mirroring CombinationDetailPage so multi-photo
          entries and per-entry detail get full real estate. */}
      {resultsWithPhotos.length > 0 && currentResult && (
        <div className="mt-4 scroll-mt-16" ref={communityResultsRef}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100">
              Community Results
            </h2>
            <p className="text-xs text-clay-500 dark:text-clay-400">
              Uploaded photos of just this glaze
            </p>
          </div>

          {/* Entry navigation */}
          <EntryPaginator
            currentIndex={currentResultIndex}
            total={resultsWithPhotos.length}
            label="Result"
            onPrev={() =>
              setCurrentResultIndex((i) =>
                i === 0 ? resultsWithPhotos.length - 1 : i - 1,
              )
            }
            onNext={() =>
              setCurrentResultIndex((i) =>
                i === resultsWithPhotos.length - 1 ? 0 : i + 1,
              )
            }
          />

          {/* Photo column + details column */}
          <div className="flex flex-col landscape:flex-row md:flex-row gap-6">
            <div className="md:w-80 landscape:w-1/3 flex-shrink-0">
              <div className="relative bg-white dark:bg-earth-800 rounded-xl shadow-sm border-2 border-sage-100 dark:border-earth-600 overflow-hidden">
                <div className="aspect-square relative max-h-[60vh] landscape:max-h-[70vh] md:max-h-none">
                  <img
                    src={prefixCdnUrl(currentResult.imageUrls[currentResultPhotoIndex])}
                    alt={glaze.displayName}
                    className="w-full h-full object-cover"
                  />
                  {currentResult.imageUrls.length > 1 && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
                      {currentResultPhotoIndex + 1} / {currentResult.imageUrls.length}
                    </div>
                  )}
                </div>
              </div>
              {/* Thumbnail strip when an entry has multiple photos */}
              {currentResult.imageUrls.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                  {currentResult.imageUrls.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentResultPhotoIndex(idx)}
                      className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === currentResultPhotoIndex
                          ? "border-terracotta-500 ring-2 ring-terracotta-300"
                          : "border-clay-200 dark:border-earth-600 hover:border-clay-400 dark:hover:border-earth-400"
                      }`}
                    >
                      <img
                        src={prefixCdnUrl(url)}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              {/* Firing information */}
              <div className="bg-white dark:bg-earth-800 rounded-xl p-4 shadow-sm border-2 border-sage-100 dark:border-earth-600">
                <h3 className="font-semibold text-clay-800 dark:text-clay-100 mb-3">
                  Firing Information
                </h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-clay-600 dark:text-clay-400">Cone</dt>
                    <dd className="font-medium text-clay-800 dark:text-clay-200">
                      {currentResult.cone ?? "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-clay-600 dark:text-clay-400">Coats</dt>
                    <dd className="font-medium text-clay-800 dark:text-clay-200">
                      {currentResult.coats}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-clay-600 dark:text-clay-400">Clay Body</dt>
                    <dd className="font-medium text-clay-800 dark:text-clay-200">
                      {currentResult.clayBody ?? "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-clay-600 dark:text-clay-400">Submitted By</dt>
                    <dd className="font-medium text-clay-800 dark:text-clay-200">
                      <Link
                        to={`/user/${currentResult.userId}`}
                        className="text-terracotta-600 dark:text-terracotta-400 hover:underline"
                      >
                        {currentResult.userId === user?.uid
                          ? "You"
                          : `User ${currentResult.userId.slice(0, 8)}`}
                      </Link>
                    </dd>
                  </div>
                </dl>

                {currentResult.notes && (
                  <div className="mt-3 pt-3 border-t border-clay-200 dark:border-earth-600">
                    <p className="text-sm text-clay-600 dark:text-clay-400">
                      <span className="font-medium text-clay-700 dark:text-clay-300">
                        Notes:
                      </span>{" "}
                      {currentResult.notes}
                    </p>
                  </div>
                )}

                {currentResult.tags && currentResult.tags.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-clay-200 dark:border-earth-600">
                    <div className="flex flex-wrap gap-2">
                      {currentResult.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300 text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Owner actions */}
              {canManageResult(currentResult.userId) && (
                <div className="bg-white dark:bg-earth-800 rounded-xl p-4 shadow-sm border-2 border-sage-100 dark:border-earth-600">
                  {deletingResultId === currentResult.id ? (
                    <ConfirmAction
                      message="Delete this result?"
                      isPending={isDeleting}
                      onCancel={() => setDeletingResultId(null)}
                      onConfirm={() => handleDeleteResult(currentResult.id)}
                    />
                  ) : (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/upload?edit=${currentResult.id}`)}
                        className="text-sm px-3 py-1 rounded-lg border border-terracotta-300 dark:border-terracotta-700 text-terracotta-600 dark:text-terracotta-400 hover:bg-terracotta-50 dark:hover:bg-terracotta-900/30"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingResultId(currentResult.id)}
                        className="text-sm text-clay-500 hover:text-red-500 dark:hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In Combinations — community combo entries that include this glaze */}
      {communityCombinations.length > 0 && (
        <div className="mt-4">
          {/* Stack on mobile so the subtitle has full width to breathe; on sm+
              the subtitle hangs to the right of the heading like before. */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-3">
            <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100">
              In Combinations
            </h2>
            <p className="text-xs text-clay-500 dark:text-clay-400">
              Photos using this glaze paired with another
            </p>
          </div>
          {/* Mirrors CombinationGrid's column counts so the cards look
              identical to /combinations and the shop page. */}
          <div className="grid grid-cols-2 xsl:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {communityCombinations.map((combo) => (
              <CombinationCard key={combo.id} combination={combo} />
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      <ImageLightbox
        src={isFullscreen ? displayImage : null}
        alt={glaze.displayName}
        isOpen={isFullscreen && !!displayImage}
        onClose={() => setIsFullscreen(false)}
      />

      {/* Add to Collection / Piece */}
      <AddToContainerModal
        kind="collection"
        isOpen={isAddToCollectionOpen}
        onClose={() => setIsAddToCollectionOpen(false)}
        itemType="glaze"
        itemId={glaze.id}
        itemName={glaze.displayName}
        triggerRef={addToCollectionTriggerRef}
      />
      <AddToContainerModal
        kind="piece"
        isOpen={isAddToPieceOpen}
        onClose={() => setIsAddToPieceOpen(false)}
        itemType="glaze"
        itemId={glaze.id}
        itemName={glaze.displayName}
        triggerRef={addToPieceTriggerRef}
      />
    </PageLayout>
  );
}
