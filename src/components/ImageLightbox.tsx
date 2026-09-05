/**
 * Single-image fullscreen lightbox.
 *
 * Replaces the inline `fixed inset-0 z-50 bg-black ...` modals that
 * GlazeDetailPage and CombinationDetailPage each rebuilt by hand. Renders a
 * close button and dismisses on ESC / backdrop click.
 *
 * Optional `onPrev` / `onNext` make it a tiny prev/next gallery; the parent
 * keeps the index state and just feeds in the current `src`. Pass them only
 * when there are multiple photos to flip between.
 *
 * Optional `onDelete` adds a two-tap confirm delete button in the top-left.
 * First tap morphs the button into a red "Delete?" pill; second tap fires
 * `onDelete` and we expect the parent to advance/close. Tap-elsewhere
 * cancels. This lives here so destructive photo actions happen where the
 * user can see the photo at full size, instead of via a tiny X on a 33%
 * thumbnail in the contact sheet.
 *
 * Not to be confused with `<PhotoGallery>`, which is a full inline gallery
 * with side thumbnails and built-in state; use this when the page already has
 * its own gallery / paginator and only needs the fullscreen modal.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { springs } from "../config/animations";
import { ChevronLeft, ChevronRight, Close, Trash } from "./Icons";

interface ImageLightboxProps {
  src: string | null | undefined;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
  /** When provided, shows a left chevron and binds ArrowLeft. */
  onPrev?: () => void;
  /** When provided, shows a right chevron and binds ArrowRight. */
  onNext?: () => void;
  /** When provided, shows a top-left trash button with two-tap confirm. */
  onDelete?: () => void;
  /** Optional overlay rendered at the bottom (e.g. "3 / 7" counter). */
  footer?: ReactNode;
}

export function ImageLightbox({
  src,
  alt = "",
  isOpen,
  onClose,
  onPrev,
  onNext,
  onDelete,
  footer,
}: ImageLightboxProps) {
  // Two-tap confirm state for the delete affordance. Reset whenever the
  // lightbox closes or the user navigates to a different photo so the
  // confirm doesn't bleed across photos.
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setConfirmDelete(false);
  }, [src, isOpen]);

  // Horizontal swipe — same threshold and pattern as PhotoGallery so the
  // fullscreen gesture feels identical wherever it's used.
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && onNext) onNext();
      else if (diff < 0 && onPrev) onPrev();
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, onPrev, onNext]);

  return (
    <AnimatePresence>
      {isOpen && src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.gentle}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={onClose}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button */}
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={springs.quick}
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-10"
          >
            <Close size="xl" />
          </motion.button>

          {/* Delete button — two-tap confirm. First tap morphs the trash
              icon into a wider red "Delete?" pill; second tap fires the
              callback and we expect the parent to close/advance. */}
          {onDelete && (
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirmDelete) {
                  onDelete();
                  setConfirmDelete(false);
                } else {
                  setConfirmDelete(true);
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={springs.quick}
              aria-label={confirmDelete ? "Tap again to confirm delete" : "Delete photo"}
              className={`absolute top-4 left-4 h-10 rounded-full flex items-center justify-center transition-colors z-10 ${
                confirmDelete
                  ? "px-4 bg-red-600 text-white hover:bg-red-700 gap-1.5"
                  : "w-10 bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <Trash size={confirmDelete ? "sm" : "lg"} />
              {confirmDelete && (
                <span className="text-sm font-medium">Delete?</span>
              )}
            </motion.button>
          )}

          {/* Optional prev/next chevrons */}
          {onPrev && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              aria-label="Previous"
              className="absolute left-4 p-3 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors z-10"
            >
              <ChevronLeft size="xl" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              aria-label="Next"
              className="absolute right-4 p-3 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors z-10"
            >
              <ChevronRight size="xl" />
            </button>
          )}

          <motion.img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain p-4"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            transition={springs.gentle}
            onClick={(e) => e.stopPropagation()}
          />

          {footer && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/20 text-white text-sm z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {footer}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
