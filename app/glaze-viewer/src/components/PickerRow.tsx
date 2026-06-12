/**
 * `<PickerRow>` — the shared row chrome used inside `PickerSurface` /
 * `Combobox` lists. It standardizes:
 *   - rounded-lg card shape, inset borders, hover/selected/active states
 *   - sage focus ring, sage selected ring + bg, sage check indicator
 *   - 44px minimum touch target
 *   - children layout: free-form (caller decides what goes in the row)
 *
 * Keep this dumb on purpose — no selection state machine, no key handling.
 * Composition only. Selection logic stays in the consumer (Combobox owns its
 * activeKey cursor; AddToContainerModal mutates the server on click).
 */

import { type ReactNode, forwardRef } from "react";

export type PickerRowState = {
  /** Row matches the user's persistent selection (or "is added"). */
  isSelected?: boolean;
  /** Keyboard cursor / hover-active row (Combobox arrow-key navigation). */
  isActive?: boolean;
  /** Render fully muted + no pointer events. */
  isDisabled?: boolean;
};

export interface PickerRowProps extends PickerRowState {
  children: ReactNode;
  /** Click handler. Disabled rows ignore clicks. */
  onClick?: () => void;
  onMouseEnter?: () => void;
  className?: string;
  /** ARIA role: `option` (default, for listboxes) or `button` (action lists). */
  role?: "option" | "button";
  /** Stable DOM id for `aria-activedescendant`. */
  id?: string;
  /** Mirrors `aria-selected`. Defaults to `isSelected` when role is "option". */
  ariaSelected?: boolean;
}

const baseRow =
  // Width is `100% - mx-2 (1rem total)` so the row never overflows its
  // surface. Pairing the original `w-full` with `mx-2` made width = 100%
  // + 1rem, pushing the row past the sheet's rounded corners where the
  // `ring-1` selected state visibly bumped into the curve at the panel
  // edge. Plain `block` without an explicit width doesn't fix it because
  // `<button>` elements in Chromium shrink-to-fit even with `display:block`.
  "block text-left w-[calc(100%-1rem)] mx-2 my-0.5 rounded-lg px-3 cursor-pointer transition-colors duration-150 min-h-[44px]";

const stateClass = ({
  isSelected,
  isActive,
  isDisabled,
}: PickerRowState): string => {
  if (isDisabled) return "opacity-60 cursor-not-allowed bg-transparent";
  const bg = isSelected
    ? "bg-sage-100 dark:bg-sage-900/60 ring-1 ring-sage-400 dark:ring-sage-500"
    : "bg-transparent hover:bg-sage-100/40 dark:hover:bg-sage-900/20";
  const cursor = isActive ? "ring-1 ring-sage-500 ring-inset" : "";
  return `${bg} ${cursor}`.trim();
};

export const PickerRow = forwardRef<HTMLButtonElement, PickerRowProps>(
  function PickerRow(
    {
      children,
      onClick,
      onMouseEnter,
      isSelected = false,
      isActive = false,
      isDisabled = false,
      className,
      role = "option",
      id,
      ariaSelected,
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        role={role}
        id={id}
        aria-selected={
          role === "option" ? (ariaSelected ?? isSelected) : undefined
        }
        aria-disabled={isDisabled || undefined}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        onMouseEnter={isDisabled ? undefined : onMouseEnter}
        className={[
          baseRow,
          stateClass({ isSelected, isActive, isDisabled }),
          className ?? "",
        ].join(" ")}
      >
        <span className="flex items-center gap-3 py-2 min-h-[28px]">
          {children}
        </span>
      </button>
    );
  },
);
