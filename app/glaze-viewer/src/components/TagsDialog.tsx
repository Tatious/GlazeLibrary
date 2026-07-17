/**
 * Tags Dialog Component
 * Multi-select dialog for filtering combinations by tags
 * Uses Framer Motion for spring-based animations
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SearchInput } from "./SearchInput";
import {
  springs,
  modalOverlay,
  bottomSheet,
} from "../config/animations";
import { Close } from "./Icons";

interface TagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagsDialog({
  isOpen,
  onClose,
  availableTags,
  selectedTags,
  onTagsChange,
}: TagsDialogProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedTags);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      // Mobile = narrow screen (under 640px width) OR short screen (under 500px height, for landscape phones)
      setIsMobile(window.innerWidth < 640 || window.innerHeight < 500);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sync local state when selectedTags changes
  useEffect(() => {
    setLocalSelected(selectedTags);
  }, [selectedTags]);

  // Handle body scroll lock and focus
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Focus search input after dialog opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleTag = (tag: string) => {
    setLocalSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleApply = () => {
    onTagsChange(localSelected);
    onClose();
  };

  const handleClear = () => {
    setLocalSelected([]);
    // Commit the cleared selection immediately. The "Clear all" control lives
    // in a row that's gated on a non-empty selection, so it disappears the
    // instant it's pressed — if we only staged the change locally, a user who
    // then dismissed the dialog (tap-outside / X / Esc) without pressing
    // "Apply" would be left with the filter pill still showing the old count.
    onTagsChange([]);
  };

  // Filter tags by search (filter out undefined/null values first)
  const filteredTags = availableTags.filter(
    (tag) => tag && tag.toLowerCase().includes(search.toLowerCase()),
  );

  // Group tags by first letter for better organization
  const groupedTags = filteredTags.reduce(
    (acc, tag) => {
      const firstLetter = tag.charAt(0).toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(tag);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const sortedGroups = Object.keys(groupedTags).sort();

  // Desktop uses simple fade, mobile uses bottom sheet slide
  const desktopFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const contentVariants = isMobile ? bottomSheet : desktopFade;

  // Portal to <body> so the sheet escapes FilterBar's stacking context.
  // Without this the BatchAddBar (also fixed z-50, but later in the DOM)
  // wins the same-z tiebreaker and pokes through the bottom of the sheet.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={modalOverlay}
            transition={springs.gentle}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Dialog content */}
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={contentVariants}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`
              bg-white dark:bg-earth-800 shadow-2xl overflow-hidden
              ${
                isMobile
                  ? "absolute left-0 right-0 bottom-0 rounded-t-xl max-h-[85dvh] landscape:max-h-[95dvh]"
                  : "fixed inset-0 m-auto w-full max-w-lg h-fit max-h-[80vh] rounded-xl"
              }
            `}
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
              paddingLeft: isMobile ? "env(safe-area-inset-left)" : undefined,
              paddingRight: isMobile ? "env(safe-area-inset-right)" : undefined,
            }}
          >
            <div
              className={`flex flex-col ${isMobile ? "h-full max-h-[85dvh] landscape:max-h-[95dvh]" : "max-h-[80vh]"}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-clay-200 dark:border-earth-600">
                <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100">
                  Filter by Tags
                </h2>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.quick}
                  className="p-1 rounded-lg hover:bg-clay-100 dark:hover:bg-earth-700 text-clay-500 dark:text-clay-400 focus-ring"
                >
                  <Close size="lg" />
                </motion.button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-clay-200 dark:border-earth-600">
                <SearchInput
                  ref={searchInputRef}
                  placeholder="Search tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-clay-50 dark:bg-earth-700"
                />

                {/* Selected count */}
                <AnimatePresence>
                  {localSelected.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={springs.snappy}
                      className="mt-2 flex items-center justify-between text-sm overflow-hidden"
                    >
                      <span className="text-clay-600 dark:text-clay-400">
                        {localSelected.length} tag
                        {localSelected.length !== 1 ? "s" : ""} selected
                      </span>
                      <button
                        onClick={handleClear}
                        className="text-terracotta-500 dark:text-terracotta-400 hover:text-terracotta-700 dark:hover:text-terracotta-300 font-medium focus-ring rounded"
                      >
                        Clear all
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tags list */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredTags.length === 0 ? (
                  <p className="text-center text-clay-500 dark:text-clay-400 py-8">
                    No tags found matching "{search}"
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sortedGroups.map((letter) => (
                      <div key={letter}>
                        <h3 className="text-xs font-semibold text-clay-500 dark:text-clay-400 uppercase tracking-wider mb-2">
                          {letter}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {groupedTags[letter].map((tag) => {
                            const isSelected = localSelected.includes(tag);
                            return (
                              <motion.button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                transition={springs.quick}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium focus-ring ${
                                  isSelected
                                    ? "bg-sage-100 text-sage-700 dark:bg-sage-900 dark:text-sage-300 ring-2 ring-sage-400"
                                    : "bg-clay-100 text-clay-700 dark:bg-earth-700 dark:text-clay-300 hover:bg-clay-200 dark:hover:bg-earth-600"
                                }`}
                              >
                                {tag.charAt(0).toUpperCase() + tag.slice(1)}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-clay-200 dark:border-earth-600">
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={springs.quick}
                  className="px-4 py-2 rounded-lg text-clay-700 dark:text-clay-300 hover:bg-clay-100 active:bg-clay-200 dark:hover:bg-earth-700 dark:active:bg-earth-600 font-medium focus-ring"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleApply}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={springs.quick}
                  className="px-4 py-2 rounded-lg bg-sage-600 text-white hover:bg-sage-700 active:bg-sage-800 font-medium focus-ring"
                >
                  Apply Filters
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
