/**
 * Standardized back button.
 *
 * Replaces the inline `<Link>` / `<button onClick={() => navigate(-1)}>`
 * pattern with a hand-drawn chevron SVG. Three usage shapes:
 *
 *   <BackButton to="/pieces" label="Pieces" />          // labeled link
 *   <BackButton to={-1} label="Back" />                  // browser back
 *   <BackButton iconOnly to={-1} label="Back" />         // chevron only
 *
 * `label` is required for screen readers in all cases.
 */

import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "./Icons";

interface BackButtonProps {
  /** Router path string, or `-1` for `navigate(-1)`. */
  to: string | -1;
  label: string;
  /** Hide the text label (chevron only). Default false. */
  iconOnly?: boolean;
  className?: string;
}

const baseLabeled =
  "inline-flex items-center gap-1 text-sm text-clay-500 dark:text-clay-400 hover:text-clay-700 dark:hover:text-clay-300 transition-colors";
const baseIconOnly =
  "p-1 -ml-1 text-clay-600 dark:text-clay-400 hover:text-clay-800 dark:hover:text-clay-200 transition-colors";

export function BackButton({
  to,
  label,
  iconOnly = false,
  className = "",
}: BackButtonProps) {
  const navigate = useNavigate();
  const classes = `${iconOnly ? baseIconOnly : baseLabeled} ${className}`.trim();

  const content = (
    <>
      <ChevronLeft />
      {!iconOnly && <span>{label}</span>}
    </>
  );

  if (to === -1) {
    return (
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label={iconOnly ? label : undefined}
        className={classes}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={to} aria-label={iconOnly ? label : undefined} className={classes}>
      {content}
    </Link>
  );
}
