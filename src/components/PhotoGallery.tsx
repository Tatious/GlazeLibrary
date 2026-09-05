/**
 * Photo Gallery Component
 * Swipeable photo gallery for combination detail view
 * Uses Framer Motion for smooth image transitions
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CombinationPhoto } from "../types/models";
import { springs } from "../config/animations";
import { prefixCdnUrl } from "../utils/glazeUtils";
import { ChevronLeft, ChevronRight, Close, Expand, Image } from "./Icons";

interface PhotoGalleryProps {
  photos: CombinationPhoto[];
  combinationName: string;
}

export function PhotoGallery({ photos, combinationName }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, goToNext, goToPrevious]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    setTouchStart(null);
  };

  if (photos.length === 0) {
    return (
      <div className="aspect-square bg-clay-100 dark:bg-earth-800 rounded-lg flex items-center justify-center text-clay-400 dark:text-earth-500">
        <div className="text-center">
          <Image className="w-16 h-16 mx-auto mb-2" strokeWidth={1.5} />
          <p>No photos available</p>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <>
      {/* Main Gallery */}
      <div className="space-y-4">
        {/* Main Image */}
        <div
          className="relative aspect-square max-h-[40vh] xs:max-h-none xsl:max-h-[55vh] max-w-[40vh] xs:max-w-none xsl:max-w-[55vh] md:max-w-none mx-auto md:mx-0 w-full bg-white dark:bg-earth-800 rounded-xl overflow-hidden border-2 border-sage-100 dark:border-earth-600 cursor-pointer"
          onClick={() => setIsFullscreen(true)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={currentIndex}
              src={prefixCdnUrl(currentPhoto.url)}
              alt={`${combinationName} - Photo ${currentIndex + 1}`}
              className="w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={springs.gentle}
            />
          </AnimatePresence>

          {/* Navigation arrows (desktop) */}
          {photos.length > 1 && (
            <>
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={springs.quick}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors hidden sm:flex focus-ring"
              >
                <ChevronLeft size="xl" />
              </motion.button>
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={springs.quick}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors hidden sm:flex focus-ring"
              >
                <ChevronRight size="xl" />
              </motion.button>
            </>
          )}

          {/* Photo counter - only show if more than one photo */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
              {currentIndex + 1} / {photos.length}
            </div>
          )}

          {/* Expand icon */}
          <motion.button
            onClick={() => setIsFullscreen(true)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={springs.quick}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors focus-ring"
          >
            <Expand />
          </motion.button>
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="grid grid-cols-6 gap-2 max-w-[40vh] xs:max-w-none xsl:max-w-none mx-auto md:mx-0">
            {photos.map((photo, index) => (
              <motion.button
                key={photo.id}
                onClick={() => setCurrentIndex(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={springs.quick}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all focus-ring ${
                  index === currentIndex
                    ? "border-moss-500 ring-2 ring-moss-500/30"
                    : "border-sage-200 dark:border-earth-600 hover:border-moss-300 opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={prefixCdnUrl(photo.url)}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </motion.button>
            ))}
          </div>
        )}

        {/* Photo count */}
        <p className="text-sm text-clay-600 dark:text-clay-400 text-center md:text-left">
          {photos.length} photo{photos.length !== 1 ? "s" : ""} available
        </p>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.gentle}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setIsFullscreen(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Close button */}
            <motion.button
              onClick={() => setIsFullscreen(false)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.quick}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-10 focus-ring"
            >
              <Close size="xl" />
            </motion.button>

            {/* Image */}
            <AnimatePresence mode="wait">
              <motion.img
                key={currentIndex}
                src={prefixCdnUrl(currentPhoto.url)}
                alt={`${combinationName} - Photo ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={springs.gentle}
              />
            </AnimatePresence>

            {/* Navigation */}
            {photos.length > 1 && (
              <>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.quick}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors focus-ring"
                >
                  <ChevronLeft size="2xl" />
                </motion.button>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.quick}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors focus-ring"
                >
                  <ChevronRight size="2xl" />
                </motion.button>

                {/* Counter - only show if more than one photo */}
                {photos.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/20 text-white">
                    {currentIndex + 1} / {photos.length}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
