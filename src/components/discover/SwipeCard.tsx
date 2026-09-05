/**
 * Tinder-style swipe card used by DiscoverPage.
 *
 * Owns: drag motion, rotation/opacity transforms, swipe-direction detection,
 * the "PICK" / "PASS" overlay visibility.
 *
 * Does NOT own: the deck, the seed, the like list — those stay on the page.
 */

import { useRef } from "react";
import {
  motion,
  PanInfo,
  useDragControls,
  useMotionValue,
  useTransform,
} from "framer-motion";
import type { Glaze, GlazeCombination } from "../../types/models";
import {
  getCombinationImage,
  getPrimaryImage,
} from "../../utils/glazeUtils";

export type DiscoverItem =
  | { type: "glaze"; data: Glaze }
  | { type: "combination"; data: GlazeCombination };

const SWIPE_THRESHOLD = 100;

interface SwipeCardProps {
  item: DiscoverItem;
  onSwipe: (direction: "left" | "right") => void;
}

export function SwipeCard({ item, onSwipe }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(
    x,
    [-200, -100, 0, 100, 200],
    [0.5, 1, 1, 1, 0.5],
  );
  const dragControls = useDragControls();
  const isDraggingRef = useRef(false);

  // Indicator overlays
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    isDraggingRef.current = false;
    // Only trigger swipe if horizontal movement is dominant
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);

    if (absX > absY * 1.5) {
      if (info.offset.x > SWIPE_THRESHOLD) {
        onSwipe("right");
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        onSwipe("left");
      }
    }
  };

  const imageUrl =
    item.type === "glaze"
      ? getPrimaryImage(item.data)
      : getCombinationImage(item.data);

  const title = item.data.displayName;

  const subtitle =
    item.type === "glaze"
      ? `${item.data.brand} ${item.data.series}`
      : `${item.data.topGlaze.displayName} over ${item.data.bottomGlaze.displayName}`;

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
      style={{ x, rotate, opacity, touchAction: "pan-y" }}
      drag="x"
      dragControls={dragControls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      dragDirectionLock
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing" }}
    >
      <div className="w-full h-full bg-white dark:bg-earth-800 rounded-2xl shadow-xl overflow-hidden border border-clay-200 dark:border-earth-700 flex flex-col landscape:flex-row">
        {/* Image */}
        <div className="relative h-3/4 landscape:h-full landscape:aspect-square bg-clay-100 dark:bg-earth-700 flex-shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500">
              No image
            </div>
          )}

          {/* Swipe indicators */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-moss-500/20"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-4xl landscape:text-2xl font-bold text-moss-500 border-4 border-moss-500 rounded-lg px-4 py-2 rotate-[-20deg]">
              PICK
            </span>
          </motion.div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-clay-500/20"
            style={{ opacity: nopeOpacity }}
          >
            <span className="text-4xl landscape:text-2xl font-bold text-clay-500 border-4 border-clay-500 rounded-lg px-4 py-2 rotate-[20deg]">
              PASS
            </span>
          </motion.div>

          {/* Type badge */}
          <div className="absolute top-3 left-3">
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                item.type === "glaze"
                  ? "bg-moss-500 text-white"
                  : "bg-terracotta-500 text-white"
              }`}
            >
              {item.type === "glaze" ? "Glaze" : "Combo"}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="h-1/4 landscape:h-full landscape:w-1/3 p-4 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-clay-800 dark:text-clay-200 truncate landscape:whitespace-normal landscape:line-clamp-2">
            {title}
          </h3>
          <p className="text-sm text-clay-500 dark:text-clay-400 truncate landscape:whitespace-normal landscape:line-clamp-3 landscape:mt-2">
            {subtitle}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
