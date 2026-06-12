/**
 * Standardized loading spinner.
 *
 * Replaces the dozen+ copies of
 *   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta-500" />
 * scattered across the app. Pick a size; pick whether you want a screen-filling
 * wrapper (`fullScreen`) or just the dial (`bare`).
 */

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  /** "fullScreen" centers the spinner in a screen-height flex box (use for
   *  page-level loading states). "block" centers it in a padded block (use
   *  inside cards / sections). "inline" returns just the dial (use inside
   *  buttons or rows). */
  layout?: "fullScreen" | "block" | "inline";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-5 w-5 border-2",
  md: "h-10 w-10 border-2",
  lg: "h-12 w-12 border-[3px]",
};

export function Spinner({
  size = "lg",
  layout = "block",
  className = "",
}: SpinnerProps) {
  const dial = (
    <div
      className={`animate-spin rounded-full border-terracotta-500 border-t-transparent ${SIZE_CLASSES[size]} ${className}`.trim()}
      role="status"
      aria-label="Loading"
    />
  );

  if (layout === "inline") return dial;

  if (layout === "fullScreen") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        {dial}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">{dial}</div>
  );
}
