import type { PieceStage } from "../types/models";

/** Display labels for each pottery stage. */
export const STAGE_LABELS: Record<PieceStage, string> = {
  greenware: "Greenware",
  bisqueware: "Bisqueware",
  fired: "Fired",
};

/**
 * Tailwind badge classes for each stage.
 * Greenware = green (sage), Bisqueware = yellow (butter), Fired = red (terracotta).
 * Import this wherever stage badges are rendered so the colors stay consistent.
 */
export const STAGE_BADGE_COLORS: Record<PieceStage, string> = {
  greenware:
    "bg-sage-100 text-sage-700 dark:bg-sage-900/40 dark:text-sage-300",
  bisqueware:
    "bg-butter-100 text-butter-700 dark:bg-butter-900/40 dark:text-butter-300",
  fired:
    "bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-900/40 dark:text-terracotta-300",
};
