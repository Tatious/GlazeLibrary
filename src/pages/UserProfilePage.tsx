/**
 * User Profile Page
 * Shows a user's uploaded combinations, saved collections, and pottery pieces
 * Works for viewing your own profile or other users
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  useCombinations,
  useGlazes,
  useMyGlazes,
} from "../hooks/useGlazeData";
import { useUserUploads } from "../hooks/useUploads";
import { toUploadCard } from "../api/uploadsApi";
import { listPieces } from "../api/piecesApi";
import {
  getCollections,
  createCollection,
} from "../api/collectionsApi";
import { getProfile } from "../api/profileApi";
import { getPrimaryImage, getCombinationImage, prefixCdnUrl } from "../utils/glazeUtils";
import { STAGE_BADGE_COLORS } from "../lib/pieceStages";
import { Spinner } from "../components/Spinner";
import { Modal } from "../components/Modal";
import { PageLayout } from "../components/PageLayout";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/Input";
import {
  Camera,
  ChevronRight,
  Heart,
  Image,
  Palette,
  Plus,
} from "../components/Icons";
import type {
  Collection,
  PotteryPiece,
} from "../types/models";
import type { Profile } from "../types/firestore";

export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: allCombinations, isLoading } = useCombinations();
  const { data: glazes = [] } = useGlazes();

  const isOwnProfile = user?.uid === userId;

  // Get saved collections (only for own profile)
  const [savedCollections, setSavedCollections] = useState<Collection[]>([]);
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Pieces (only for own profile)
  const [pieces, setPieces] = useState<PotteryPiece[]>([]);

  // Fetch other user's profile when viewing their page
  const [otherUserProfile, setOtherUserProfile] = useState<Profile | null>(
    null,
  );

  useEffect(() => {
    async function fetchOtherUserProfile() {
      if (!isOwnProfile && userId) {
        try {
          const profile = await getProfile(userId);
          if (profile) setOtherUserProfile(profile);
        } catch (err) {
          console.error("Failed to fetch profile:", err);
        }
      }
    }
    fetchOtherUserProfile();
  }, [isOwnProfile, userId]);

  const loadCollections = useCallback(async () => {
    if (userId) {
      const collections = await getCollections(userId);
      setSavedCollections(collections);
    }
  }, [userId]);

  const loadPieces = useCallback(async () => {
    if (isOwnProfile && user?.uid) {
      try {
        const data = await listPieces(user.uid);
        setPieces(data);
      } catch (err) {
        console.error("Failed to load pieces:", err);
      }
    }
  }, [isOwnProfile, user?.uid]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const created = await createCollection(
        newCollectionName.trim(),
        [],
        undefined,
        user?.uid,
      );
      setShowNewCollectionModal(false);
      setNewCollectionName("");
      navigate(`/collections/${created.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Every upload by this user — includes layered combos AND single-glaze
  // results, which used to be missing here (they're not in `useCombinations`).
  const { data: userUploads = [], isLoading: uploadsLoading } = useUserUploads(userId);
  const uploadCards = userUploads.map((u) => toUploadCard(u, glazes));
  const totalEntries = uploadCards.length;

  // Favorites (own profile only — favorites are private). Resolve the IDs in
  // myGlazes against the loaded glaze + combination catalogs so each card
  // gets a real thumbnail + display name.
  const myGlazes = useMyGlazes();
  const favoritedCombinations = useMemo(() => {
    if (!isOwnProfile) return [];
    const favIds = new Set(myGlazes.favoriteCombinations ?? []);
    if (favIds.size === 0) return [];
    return (allCombinations ?? []).filter((c) => favIds.has(c.id));
  }, [isOwnProfile, myGlazes.favoriteCombinations, allCombinations]);
  const favoritedGlazes = useMemo(() => {
    if (!isOwnProfile) return [];
    return glazes.filter((g) => myGlazes.glazes[g.id]?.favorite);
  }, [isOwnProfile, glazes, myGlazes.glazes]);
  const totalFavorites = favoritedCombinations.length + favoritedGlazes.length;

  // Get display name
  const displayName = isOwnProfile
    ? profile?.display_name || user?.email?.split("@")[0] || "User"
    : otherUserProfile?.display_name ||
      `User ${userId?.slice(0, 8) || "Unknown"}`;

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
      } else if (allCombinations) {
        const combo = allCombinations.find((c) => c.id === like.id);
        if (combo) {
          const img = getCombinationImage(combo);
          if (img) images.push(img);
        }
      }
    }
    return images;
  };

  if (isLoading || uploadsLoading) {
    return (
      <PageLayout maxWidth="4xl" padY="12">
        <Spinner />
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="4xl" padY="12" className="flex flex-col gap-4">
      {/* Profile Header */}
      <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
        <div className="flex items-center gap-4">
          {/* Avatar. `shrink-0` is load-bearing here — without it the
              gradient swatch collapses into an oval as soon as the name +
              stats column grows past the row's flex budget. */}
          <div className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-br from-terracotta-400 to-terracotta-600 flex items-center justify-center text-white text-2xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200">
              {displayName}
            </h1>
            <p className="text-clay-500 dark:text-clay-400 text-sm">
              {isOwnProfile && (
                <><span className="whitespace-nowrap">{pieces.filter(p => !p.isArchived).length} {pieces.filter(p => !p.isArchived).length === 1 ? "piece" : "pieces"}</span>{" • "}</>
              )}
              <span className="whitespace-nowrap">{savedCollections.length} {savedCollections.length === 1 ? "collection" : "collections"}</span>
              {" • "}
              <span className="whitespace-nowrap">{totalEntries} {totalEntries === 1 ? "upload" : "uploads"}</span>
              {isOwnProfile && (
                <>{" • "}<span className="whitespace-nowrap">{totalFavorites} {totalFavorites === 1 ? "favorite" : "favorites"}</span></>
              )}
            </p>
          </div>
        </div>

        {isOwnProfile && (
          <div className="mt-4 pt-4 border-t border-clay-200 dark:border-earth-600">
            <Link
              to="/settings"
              className="text-sm text-terracotta-600 dark:text-terracotta-400 hover:underline font-medium"
            >
              Profile Settings →
            </Link>
          </div>
        )}
      </div>

      {/* Pottery Pieces Section (own profile only) */}
      {isOwnProfile && (
        <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
          <div className="flex items-center justify-between mb-6 gap-3">
            <Link
              to="/pieces"
              className="text-xl font-bold text-clay-800 dark:text-clay-200 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors flex items-center gap-2 min-w-0"
            >
              <Camera
                className="w-5 h-5 text-terracotta-500 dark:text-terracotta-400 shrink-0"
                aria-hidden
              />
              <span className="truncate">Pieces</span>
              <ChevronRight />
            </Link>
            {/* Compact header action — the empty state used to own a big CTA
                button, but it duplicated the header chrome. A small + icon
                in the corner is enough since the section's title already
                tells the user what kind of thing they're creating. */}
            <Link
              to="/pieces"
              state={{ openNewPieceModal: true }}
              aria-label="New piece"
              title="New piece"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white transition-colors"
            >
              <Plus />
            </Link>
          </div>
          {pieces.filter(p => !p.isArchived).length === 0 ? (
            <EmptyState
              variant="bare"
              pad="compact"
              icon={<Camera size="2xl" strokeWidth={1.5} />}
              title="No pieces yet"
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pieces.filter(p => !p.isArchived).slice(0, 6).map((piece) => {
                const latestPhoto = piece.stageRecords
                  .flatMap((s) => s.photos)
                  .slice(-1)[0];

                return (
                  <Link
                    key={piece.id}
                    to={`/pieces/${piece.id}`}
                    className="group block rounded-xl border border-clay-200 dark:border-earth-600 hover:border-terracotta-300 dark:hover:border-terracotta-600 overflow-hidden transition-colors"
                  >
                    <div className="aspect-square bg-clay-100 dark:bg-earth-700">
                      {latestPhoto ? (
                        <img src={latestPhoto} alt={piece.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-clay-300 dark:text-earth-600">
                          <Camera size="2xl" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium text-clay-800 dark:text-clay-200 truncate group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400">
                        {piece.name}
                      </p>
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium mt-1 ${STAGE_BADGE_COLORS[piece.currentStage]}`}>
                        {piece.currentStage}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Saved Collections Section */}
      <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
        <div className="flex items-center justify-between mb-6 gap-3">
          {isOwnProfile ? (
            <Link
              to="/collections"
              className="text-xl font-bold text-clay-800 dark:text-clay-200 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors flex items-center gap-2 min-w-0"
            >
              <Palette
                className="w-5 h-5 text-terracotta-500 dark:text-terracotta-400 shrink-0"
                aria-hidden
              />
              <span className="truncate">Collections</span>
              <ChevronRight />
            </Link>
          ) : (
            <h2 className="text-xl font-bold text-clay-800 dark:text-clay-200 flex items-center gap-2">
              <Palette
                className="w-5 h-5 text-terracotta-500 dark:text-terracotta-400 shrink-0"
                aria-hidden
              />
              Collections
            </h2>
          )}
          {/* Compact header action (own profile only). Mirrors the Pieces
              header so the two cards feel like siblings. */}
          {isOwnProfile && (
            <button
              onClick={() => setShowNewCollectionModal(true)}
              aria-label="New collection"
              title="New collection"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white transition-colors"
            >
              <Plus />
            </button>
          )}
        </div>

        {savedCollections.length === 0 ? (
          <EmptyState
            variant="bare"
            pad="compact"
            icon={<Palette size="2xl" strokeWidth={1.5} />}
            title={isOwnProfile ? "No saved collections yet" : "No collections yet"}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedCollections.map((collection) => {
              const images = getCollectionImages(collection);
              return (
                <Link
                  key={collection.id}
                  to={`/collections/${collection.id}`}
                  className="group block p-4 rounded-xl border border-clay-200 dark:border-earth-600 hover:border-terracotta-300 dark:hover:border-terracotta-600 transition-colors"
                >
                  {/* Image preview grid */}
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="aspect-square rounded bg-clay-100 dark:bg-earth-700 overflow-hidden"
                      >
                        {images[i] && (
                          <img
                            src={images[i]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <h3 className="font-medium text-clay-800 dark:text-clay-200 group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 truncate">
                    {collection.name}
                  </h3>
                  <p className="text-xs text-clay-500 dark:text-clay-400">
                    {collection.likes.length} item
                    {collection.likes.length !== 1 ? "s" : ""} •{" "}
                    {new Date(collection.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Uploads Section */}
      <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
        <div className="flex items-center justify-between mb-6 gap-3">
          {isOwnProfile ? (
            <Link
              to="/uploads"
              className="text-xl font-bold text-clay-800 dark:text-clay-200 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors flex items-center gap-2 min-w-0"
            >
              <Image
                className="w-5 h-5 text-terracotta-500 dark:text-terracotta-400 shrink-0"
                aria-hidden
              />
              <span className="truncate">Uploads</span>
              <ChevronRight />
            </Link>
          ) : (
            <h2 className="text-xl font-bold text-clay-800 dark:text-clay-200 flex items-center gap-2">
              <Image
                className="w-5 h-5 text-terracotta-500 dark:text-terracotta-400 shrink-0"
                aria-hidden
              />
              Uploads
            </h2>
          )}
          {/* Compact header action (own profile only). Mirrors Pieces /
              Collections so the three section cards feel like siblings. */}
          {isOwnProfile && (
            <Link
              to="/upload"
              aria-label="New upload"
              title="New upload"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white transition-colors"
            >
              <Plus />
            </Link>
          )}
        </div>

        {uploadCards.length === 0 ? (
          <EmptyState
            variant="bare"
            pad="compact"
            icon={<Image size="2xl" strokeWidth={1.5} />}
            title={
              isOwnProfile
                ? "No uploads yet"
                : "This user hasn't uploaded any results yet."
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {uploadCards.map((card) => (
              <Link
                key={card.entryId}
                to={card.linkTo}
                className="group block"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-clay-100 dark:bg-earth-700 mb-2 relative">
                  {card.imageUrl ? (
                    <img
                      src={prefixCdnUrl(card.imageUrl)}
                      alt={card.displayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500">
                      <Image size="2xl" />
                    </div>
                  )}
                  {card.isSingleGlaze && (
                    <span className="absolute top-1 left-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-clay-900/70 text-white">
                      Single
                    </span>
                  )}
                </div>
                <p className="text-sm text-clay-700 dark:text-clay-300 font-medium group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 line-clamp-2">
                  {card.displayName}
                </p>
                <p className="text-xs text-clay-500 dark:text-clay-400">
                  {card.meta}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Favorites Section (own profile only — private to the user). */}
      {isOwnProfile && (
        <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-clay-800 dark:text-clay-200 flex items-center gap-2">
              <Heart
                className="w-5 h-5 text-terracotta-500 dark:text-terracotta-400"
                filled
                aria-hidden
              />
              Favorites
            </h2>
            {totalFavorites > 0 && (
              <span className="text-sm text-clay-500 dark:text-clay-400">
                {totalFavorites} item{totalFavorites === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {totalFavorites === 0 ? (
            <EmptyState
              variant="bare"
              pad="compact"
              icon={<Heart size="2xl" strokeWidth={1.5} aria-hidden />}
              title="No favorites yet"
              description="Tap the heart on any glaze or combo to save it here."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link
                    to="/glazes"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-clay-300 dark:border-earth-600 text-sm font-medium text-clay-700 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
                  >
                    Browse glazes
                  </Link>
                  <Link
                    to="/combinations"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-clay-300 dark:border-earth-600 text-sm font-medium text-clay-700 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
                  >
                    Browse combos
                  </Link>
                </div>
              }
            />
          ) : (
            <div className="space-y-6">
              {favoritedCombinations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-clay-600 dark:text-clay-400 uppercase tracking-wide mb-3">
                    Combinations ({favoritedCombinations.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favoritedCombinations.map((combo) => {
                      const img = getCombinationImage(combo);
                      const displayName =
                        combo.displayName ||
                        `${combo.topGlaze.displayName} over ${combo.bottomGlaze.displayName}`;
                      return (
                        <Link
                          key={combo.id}
                          to={`/combination/${combo.id}`}
                          className="group block"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-clay-100 dark:bg-earth-700 mb-2">
                            {img ? (
                              <img
                                src={prefixCdnUrl(img) || img}
                                alt={displayName}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500 text-xs">
                                No photo
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-clay-700 dark:text-clay-300 font-medium group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 line-clamp-2">
                            {displayName}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {favoritedGlazes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-clay-600 dark:text-clay-400 uppercase tracking-wide mb-3">
                    Glazes ({favoritedGlazes.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favoritedGlazes.map((glaze) => {
                      const img = getPrimaryImage(glaze);
                      return (
                        <Link
                          key={glaze.id}
                          to={`/glaze/${glaze.id}`}
                          className="group block"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-clay-100 dark:bg-earth-700 mb-2">
                            {img ? (
                              <img
                                src={img}
                                alt={glaze.displayName}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500 text-xs">
                                No photo
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-clay-700 dark:text-clay-300 font-medium group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 line-clamp-2">
                            {glaze.displayName}
                          </p>
                          <p className="text-xs text-clay-500 dark:text-clay-400">
                            {glaze.brand}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Collection Modal */}
      <Modal
        isOpen={showNewCollectionModal}
        onClose={() => {
          setShowNewCollectionModal(false);
          setNewCollectionName("");
        }}
        title="New Collection"
        footer={
          <>
            <button
              onClick={() => {
                setShowNewCollectionModal(false);
                setNewCollectionName("");
              }}
              className="px-4 py-2 text-sm font-medium text-clay-600 dark:text-clay-400 hover:text-clay-800 dark:hover:text-clay-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim() || isCreating}
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
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
          autoFocus
        />
      </Modal>
    </PageLayout>
  );
}
