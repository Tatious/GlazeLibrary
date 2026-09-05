/**
 * Standard page chrome — applies max-width, padding, and iOS safe-area insets
 * consistently. Use instead of repeating
 *   className="max-w-Xxl mx-auto px-4 py-8"
 *   style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", ... }}
 * inline on every page.
 */

import type { CSSProperties, ReactNode } from "react";

type MaxWidth = "md" | "lg" | "2xl" | "3xl" | "4xl" | "7xl";
type PadY = "4" | "6" | "8" | "12";

// Tailwind's JIT can only see complete literal class names; this is the lookup.
const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "7xl": "max-w-7xl",
};
// Asymmetric vertical padding: the global nav header already provides ~3rem
// of space above the main element, so doubling it with page-level top
// padding made every page feel like it was floating well below the nav. We
// flatten the top padding across all `padY` choices so every page has the
// same gap under the nav, while preserving each choice's bottom padding so
// long forms still get breathing room above the footer.
const PAD_TOP_CLASS: Record<PadY, string> = {
  "4": "pt-3",
  "6": "pt-4",
  "8": "pt-4",
  "12": "pt-4",
};
const PAD_BOTTOM_CLASS: Record<PadY, string> = {
  "4": "pb-4",
  "6": "pb-6",
  "8": "pb-8",
  "12": "pb-12",
};

interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: MaxWidth;
  padY?: PadY;
  className?: string;
  style?: CSSProperties;
}

export function PageLayout({
  children,
  maxWidth = "7xl",
  padY = "6",
  className = "",
  style,
}: PageLayoutProps) {
  return (
    <main
      className={`${MAX_WIDTH_CLASS[maxWidth]} mx-auto px-4 ${PAD_TOP_CLASS[padY]} ${PAD_BOTTOM_CLASS[padY]} ${className}`.trim()}
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        ...style,
      }}
    >
      {children}
    </main>
  );
}
