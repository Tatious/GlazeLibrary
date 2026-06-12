/**
 * Shared animation configurations using Framer Motion spring physics
 * Provides consistent, natural-feeling animations across the app
 */

// Spring configurations for different use cases
export const springs = {
  // Snappy spring for UI interactions (buttons, toggles)
  snappy: { type: "spring", stiffness: 500, damping: 35 } as const,

  // Gentle spring for content transitions
  gentle: { type: "spring", stiffness: 400, damping: 28 } as const,

  // Bouncy spring for emphasis (badges, notifications)
  bouncy: { type: "spring", stiffness: 500, damping: 18 } as const,

  // Soft spring for large content areas (page transitions, modals)
  soft: { type: "spring", stiffness: 350, damping: 30 } as const,

  // Quick spring for micro-interactions (hover effects)
  quick: { type: "spring", stiffness: 600, damping: 35 } as const,
};

// Common animation variants
export const fadeInScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Card hover variants
export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow:
      "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
  tap: {
    scale: 0.98,
    y: 0,
  },
};

// Expand/collapse variants
export const expandCollapse = {
  collapsed: {
    height: 0,
    opacity: 0,
  },
  expanded: {
    height: "auto",
    opacity: 1,
  },
};

// Modal/dialog variants
export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Bottom sheet variants (mobile)
export const bottomSheet = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
};
