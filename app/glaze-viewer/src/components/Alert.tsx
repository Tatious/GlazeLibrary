/**
 * Standardized inline alert / banner.
 *
 * Replaces the half-dozen copies of
 *   <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
 *     {error}
 *   </div>
 * scattered across signup / login / settings / piece-create / upload / admin
 * pages. Pick a `variant` for tone; the markup is identical otherwise.
 */

import { type ReactNode } from "react";

type AlertVariant = "error" | "success" | "info";

interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error:
    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  success:
    "bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300",
  info:
    "bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300",
};

export function Alert({
  variant = "error",
  children,
  className = "",
}: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`p-3 rounded-lg text-sm ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
