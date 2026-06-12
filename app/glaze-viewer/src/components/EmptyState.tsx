/**
 * Standard "nothing here yet" panel — icon + title + body + optional CTA.
 *
 * Used on Pieces / Uploads / Collections empty list pages and on profile
 * sections so the empty state always looks the same.
 */

import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Visual density. `card` adds the white card background + border. */
  variant?: "card" | "bare";
  /** Vertical padding. `compact` is meant for when this is nested inside
      another card that already owns its own padding — the default `lg`
      looks floaty in that context. */
  pad?: "lg" | "compact";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  pad = "lg",
}: EmptyStateProps) {
  // `compact` mode is for empty states nested inside another card whose own
  // padding already owns the breathing room. Stacking py-12 on top of the
  // parent's p-6 produces a floating-island look with way too much air.
  const padY = pad === "compact" ? "py-0" : "py-12";
  const wrapper =
    variant === "card"
      ? `bg-white dark:bg-earth-800 rounded-xl ${pad === "compact" ? "p-6" : "p-12"} shadow-sm border-2 border-clay-200 dark:border-earth-600 text-center`
      : `text-center ${padY}`;

  return (
    <div className={wrapper}>
      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-clay-100 dark:bg-earth-700 flex items-center justify-center text-clay-400 dark:text-earth-500">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200 mb-2">
        {title}
      </h2>
      {description && (
        <div className="text-clay-500 dark:text-clay-400 mb-4 max-w-xs mx-auto">
          {description}
        </div>
      )}
      {action && <div className="flex flex-col items-center gap-3 mt-3">{action}</div>}
    </div>
  );
}
