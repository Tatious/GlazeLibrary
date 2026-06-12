/**
 * Shared `<Checkbox>` primitive.
 *
 * Custom-styled (vs. native `<input type="checkbox">`) so the empty state
 * matches the app's clay/earth palette and the checked state uses the
 * same sage + Check icon vocabulary as PickerRow / Combobox row selection.
 *
 * The native input is kept as `peer sr-only` so keyboard, screen reader,
 * label-click, and form submission behavior are all stock.
 *
 * Usage:
 *   <Checkbox checked={x} onChange={(e) => setX(e.target.checked)} label="…" />
 *
 * For a bare control without an attached label (e.g. a list-row select
 * affordance), pass `label={null}` and an `aria-label` on the input via
 * `inputProps`.
 */

import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "./Icons";

type Size = "sm" | "md";

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** Visible label rendered after the box. Pass `null` for control-only. */
  label?: ReactNode;
  /** `md` (default, 20px) or `sm` (16px). */
  size?: Size;
}

const BOX_SIZE: Record<Size, string> = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
};

export function Checkbox({
  label,
  size = "md",
  checked,
  className = "",
  ...inputProps
}: CheckboxProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 cursor-pointer select-none group ${className}`}
    >
      <input
        {...inputProps}
        type="checkbox"
        checked={checked}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`${BOX_SIZE[size]} shrink-0 rounded border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-700 flex items-center justify-center transition-colors peer-checked:bg-sage-600 peer-checked:border-sage-600 dark:peer-checked:bg-sage-500 dark:peer-checked:border-sage-500 peer-focus-visible:ring-2 peer-focus-visible:ring-sage-500/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-earth-800 group-hover:border-clay-400 dark:group-hover:border-earth-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed`}
      >
        <Check
          size={size === "md" ? "sm" : "xs"}
          strokeWidth={3}
          className={`text-white transition-opacity ${
            checked ? "opacity-100" : "opacity-0"
          }`}
        />
      </span>
      {label !== null && label !== undefined && (
        <span className="text-sm text-clay-600 dark:text-clay-400">
          {label}
        </span>
      )}
    </label>
  );
}
