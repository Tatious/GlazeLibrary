/**
 * Combination Card Component
 * Displays a single glaze combination in a grid
 */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { GlazeCombination } from "../types/models";
import {
  useMyGlazes,
  useToggleCombinationFavorite,
} from "../hooks/useGlazeData";
import { useAuth } from "../hooks/useAuth";
import { springs, cardHover } from "../config/animations";
import { prefixCdnUrl } from "../utils/glazeUtils";
import { useIsSelected, type SelectionStore } from "../hooks/useBatchSelect";
import { Badge, Check, Heart } from "./Icons";
import {
  imageMorphId,
  captureImageMorph,
  useImageMorph,
} from "../lib/imageMorph";

interface CombinationCardProps {
  combination: GlazeCombination;
  /**
   * When true, the card behaves as a selection target (no nav, no favorite
   * button) and renders a checkmark overlay reflecting the store's state.
   */
  selectionMode?: boolean;
  /** Selection store — the card subscribes to its own key only. */
  selectionStore?: SelectionStore;
}

export function CombinationCard({
  combination,
  selectionMode = false,
  selectionStore,
}: CombinationCardProps) {
  const myGlazes = useMyGlazes();
  const toggleFavorite = useToggleCombinationFavorite();
  // Favorites are per-user \u2014 hide the heart for signed-out visitors so we
  // don't show an affordance that would just bounce them to /login.
  const { user } = useAuth();

  // Shared-element morph: the cover photo flies into (and back from) the
  // CombinationDetailPage hero across the route change. The ref is attached to
  // the photo box only in nav mode (not selection mode).
  const morphRef = useImageMorph(imageMorphId("combination", combination.id));

  const ownsTop = myGlazes.glazes[combination.topGlaze.glazeId]?.owned ?? false;
  const ownsBottom =
    myGlazes.glazes[combination.bottomGlaze.glazeId]?.owned ?? false;
  const ownsBoth = ownsTop && ownsBottom;
  const isFavorited =
    myGlazes.favoriteCombinations?.includes(combination.id) ?? false;

  // v3.0: photos are nested in entries - get cover photo from first entry
  const allPhotos = combination.entries?.flatMap((e) => e.photos) ?? [];
  const coverPhoto = allPhotos.find((p) => p.isCover) ?? allPhotos[0];

  // Get display info from first entry (for cone, coats, isOfficial)
  const firstEntry = combination.entries?.[0];
  const displayName =
    combination.displayName ??
    `${combination.topGlaze.displayName} over ${combination.bottomGlaze.displayName}`;
  const cone = firstEntry?.cone ?? "?";
  const topCoats = firstEntry?.topCoats ?? combination.topGlaze.coats ?? "?";
  const bottomCoats =
    firstEntry?.bottomCoats ?? combination.bottomGlaze.coats ?? "?";
  const isOfficial = firstEntry?.isOfficial ?? false;

  // Shared inner card visual — used by both nav-mode and selection-mode.
  const cardInner = (
    <>
      {/* Photo */}
      <div
        ref={selectionMode ? undefined : morphRef}
        className="aspect-square relative overflow-hidden rounded-t-[10px] bg-clay-100 dark:bg-earth-700"
      >
        {coverPhoto ? (
          <img
            src={prefixCdnUrl(coverPhoto.url) || coverPhoto.url}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        {!coverPhoto && (
          <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500 text-sm">
            No photo
          </div>
        )}
        <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500 text-sm hidden">
          Image failed
        </div>

        {/* Top-right badge: Ownership only (hidden in selection mode to give
            the check overlay room). */}
        {ownsBoth && !selectionMode && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-moss-500 text-white text-xs font-bold shadow-md">
              ✓
            </span>
          </div>
        )}

        {/* Official badge */}
        {isOfficial && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sage-500/90 text-white shadow">
              <Badge size="xs" />
              Official
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {/* 3 lines: text-sm (14px) × leading-tight (1.25) × 3 = 52.5px */}
        <h3
          className="font-medium text-clay-800 dark:text-clay-100 text-sm leading-tight line-clamp-3"
          style={{ minHeight: "52.5px" }}
        >
          {displayName}
        </h3>
        <div className="mt-1 flex items-center justify-between text-xs text-clay-600 dark:text-clay-400">
          <span>Cone {cone}</span>
          <span>
            {topCoats}x / {bottomCoats}x
          </span>
        </div>

        {/* Glaze ownership indicators (favorite button is a sibling of
            the Link to avoid nesting interactive elements). */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                ownsTop ? "bg-moss-500" : "bg-clay-300 dark:bg-earth-600"
              }`}
              title={ownsTop ? "Own top glaze" : "Need top glaze"}
            />
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                ownsBottom ? "bg-moss-500" : "bg-clay-300 dark:bg-earth-600"
              }`}
              title={ownsBottom ? "Own bottom glaze" : "Need bottom glaze"}
            />
          </div>
          {/* Spacer where the favorite button visually overlays. Hidden in
              selection mode since there's no favorite button to overlay. */}
          {!selectionMode && <div className="w-6 h-6" aria-hidden="true" />}
        </div>
      </div>
    </>
  );

  // Selection mode: render the subscribe-aware variant so the card
  // re-renders only when its own key flips \u2014 the parent grid stays
  // untouched. No favorite button and no hover/tap motion variants here:
  // on touch, Framer's pointer-driven `whileHover` fires on pointerdown
  // and shifts the element under the finger, which makes iOS Safari drop
  // the first tap.
  if (selectionMode && selectionStore) {
    return (
      <SelectableCombinationCard
        combination={combination}
        displayName={displayName}
        store={selectionStore}
        cardInner={cardInner}
      />
    );
  }

  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={cardHover}
      transition={springs.quick}
      className="relative h-full rounded-xl"
    >
      <Link
        to={`/combination/${combination.id}`}
        onClick={() =>
          captureImageMorph(imageMorphId("combination", combination.id))
        }
        className="group block bg-white dark:bg-earth-800 rounded-xl overflow-hidden border-2 border-sage-100 dark:border-earth-600 hover:border-sage-300 dark:hover:border-sage-700 focus-ring h-full"
      >
        {cardInner}
      </Link>

      {/* Favorite button — sibling of <Link> to keep HTML valid and avoid
          the iOS Safari nested-interactive tap flakiness. Positioned over
          the spacer above. Hidden for signed-out visitors. */}
      {user && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(combination.id);
          }}
          className={`absolute bottom-3 right-3 z-10 p-1 rounded-full transition-colors ${
            isFavorited
              ? "text-terracotta-500 dark:text-terracotta-400"
              : "text-clay-300 dark:text-earth-500 hover:text-terracotta-400 dark:hover:text-terracotta-500"
          }`}
          title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart filled={isFavorited} />
        </button>
      )}
    </motion.div>
  );
}

// ============================================================================
// SelectableCombinationCard
// Subscribes to its own selection key only so a toggle re-renders just this
// card, not the rest of the (virtualized) grid.
// ============================================================================

interface SelectableCombinationCardProps {
  combination: GlazeCombination;
  displayName: string;
  store: SelectionStore;
  cardInner: React.ReactNode;
}

function SelectableCombinationCard({
  combination,
  displayName,
  store,
  cardInner,
}: SelectableCombinationCardProps) {
  const key = `combination:${combination.id}`;
  const selected = useIsSelected(store, key);

  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={() => store.toggle(key)}
        className={`block w-full text-left bg-white dark:bg-earth-800 rounded-xl overflow-hidden border-2 focus-ring h-full transition-colors touch-manipulation ${
          selected
            ? "border-terracotta-500 dark:border-terracotta-400 ring-2 ring-terracotta-300/60 dark:ring-terracotta-700/60"
            : "border-sage-100 dark:border-earth-600 hover:border-sage-300 dark:hover:border-sage-700"
        }`}
        aria-pressed={selected}
        aria-label={selected ? `Deselect ${displayName}` : `Select ${displayName}`}
      >
        {cardInner}
      </button>
      <div
        className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md pointer-events-none transition-colors ${
          selected
            ? "bg-terracotta-500 text-white"
            : "bg-white/85 dark:bg-earth-900/85 text-clay-400 dark:text-earth-500 backdrop-blur-sm"
        }`}
        aria-hidden="true"
      >
        {selected ? (
          <Check size="lg" strokeWidth={3} />
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-current" />
        )}
      </div>
    </div>
  );
}
