/**
 * Glaze-specialised `<Combobox>` — the picker most of the app uses.
 *
 * Pre-wires the generic primitive with:
 *   - `getLabel`           → `g.displayName`
 *   - `getSearchHaystack`  → code + name + series + brand + tags (case-insensitive)
 *   - `groupBy`            → brand (alpha sections in the panel)
 *   - sort                 → `displayName.localeCompare` within each section
 *   - row renderer         → thumbnail | name (+ mobile subtitle) | brand pill | check
 *   - trigger renderer     → 20px thumbnail | displayName | brand pill
 *
 * The trigger has a render slot for the chevron, so the brand pill is placed
 * *inside* the trigger flex row, never colliding with the chevron's reserved
 * `pr-9` slot. The default thumbnail falls back to a clay swatch when the
 * glaze image is missing or fails to load.
 */

import { useMemo } from "react";
import type { Glaze } from "../types/models";
import { getPrimaryImage } from "../utils/glazeUtils";
import { Combobox, type ComboboxProps } from "./Combobox";
import { Check } from "./Icons";

type GlazeComboboxProps = Omit<
  ComboboxProps<Glaze>,
  | "items"
  | "getLabel"
  | "getSearchHaystack"
  | "groupBy"
  | "renderRow"
  | "renderTriggerValue"
> & {
  glazes: Glaze[] | undefined;
};

function GlazeThumb({
  glaze,
  size = 24,
}: {
  glaze: Glaze;
  size?: 20 | 24 | 32;
}) {
  const src = getPrimaryImage(glaze);
  const sizeClass =
    size === 20 ? "w-5 h-5" : size === 24 ? "w-6 h-6" : "w-8 h-8";
  return (
    <span
      className={`relative inline-block ${sizeClass} rounded-md overflow-hidden bg-clay-100 dark:bg-earth-700 flex-shrink-0`}
      aria-hidden
    >
      {src && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </span>
  );
}

function BrandPill({ brand }: { brand: string }) {
  return (
    <span className="hidden md:inline-flex items-center text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-clay-50 text-clay-600 dark:bg-earth-700 dark:text-clay-300 whitespace-nowrap flex-shrink-0">
      {shortBrand(brand)}
    </span>
  );
}

/** Compact label for the brand pill / section header.
 *  Falls back to the raw value so any future brand still renders, just uppercase. */
function shortBrand(brand: string): string {
  const b = brand?.toLowerCase() ?? "";
  if (b.includes("seattle")) return "SPS";
  if (b.includes("amaco")) return "AMACO";
  if (b.includes("mayco")) return "MAYCO";
  return brand;
}

function renderGlazeRow(
  glaze: Glaze,
  state: { isSelected: boolean; isActive: boolean },
) {
  return (
    <>
      {/* Mobile uses the larger thumbnail + two text lines. */}
      <span className="md:hidden">
        <GlazeThumb glaze={glaze} size={32} />
      </span>
      <span className="hidden md:inline">
        <GlazeThumb glaze={glaze} size={24} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-clay-800 dark:text-clay-100 truncate">
          {glaze.displayName}
        </p>
        <p className="text-xs text-clay-500 dark:text-clay-400 truncate md:hidden">
          {shortBrand(glaze.brand)} · {glaze.code}
          {glaze.series ? ` · ${glaze.series}` : ""}
        </p>
      </div>
      <BrandPill brand={glaze.brand} />
      {state.isSelected && (
        <Check className="w-5 h-5 text-sage-600 dark:text-sage-400 flex-shrink-0" />
      )}
    </>
  );
}

function renderGlazeTrigger(selectedItems: Glaze[]) {
  if (selectedItems.length === 0) return null;
  if (selectedItems.length === 1) {
    const glaze = selectedItems[0];
    return (
      <>
        <GlazeThumb glaze={glaze} size={20} />
        <span className="truncate text-sm font-medium text-clay-800 dark:text-clay-100">
          {glaze.displayName}
        </span>
        <BrandPill brand={glaze.brand} />
      </>
    );
  }
  // Multi-select trigger: show count + first 2 thumbnails.
  return (
    <>
      <span className="flex -space-x-2">
        {selectedItems.slice(0, 3).map((g) => (
          <span
            key={g.id}
            className="ring-2 ring-white dark:ring-earth-800 rounded-md"
          >
            <GlazeThumb glaze={g} size={20} />
          </span>
        ))}
      </span>
      <span className="truncate text-sm font-medium text-clay-800 dark:text-clay-100">
        {selectedItems.length} glazes
      </span>
    </>
  );
}

export function GlazeCombobox({
  glazes,
  placeholder = "Select glaze…",
  searchPlaceholder = "Search glazes…",
  ariaLabel = "Glaze picker",
  emptyMessage = (q) => `No glazes match "${q}"`,
  noItemsMessage = "No glazes loaded yet.",
  ...rest
}: GlazeComboboxProps) {
  const sorted = useMemo(
    () =>
      [...(glazes ?? [])].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [glazes],
  );

  return (
    <Combobox<Glaze>
      items={sorted}
      getLabel={(g) => g.displayName}
      getSearchHaystack={(g) =>
        // Keep both the full brand and the short alias so users can type either.
        `${g.code ?? ""} ${g.displayName} ${g.series ?? ""} ${g.brand} ${shortBrand(g.brand)} ${(g.tags ?? []).join(" ")}`
      }
      groupBy={(g) => shortBrand(g.brand)}
      renderRow={renderGlazeRow}
      renderTriggerValue={renderGlazeTrigger}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
      noItemsMessage={noItemsMessage}
      {...rest}
    />
  );
}
