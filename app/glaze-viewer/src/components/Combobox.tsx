/**
 * Generic searchable picker.
 *
 * Replaces native `<select>` / our `<Select>` wherever we need search,
 * thumbnails, grouping, or richer row content. Presents as:
 *   - Anchored popover under the trigger on desktop
 *   - Bottom sheet on mobile (matches the TagsDialog responsive pattern)
 *
 * Owns its open / search / keyboard-cursor state internally; selection state
 * is fully controlled via `value` + `onChange`. Single-select closes on pick;
 * multi-select stays open until Apply (mirrors `TagsDialog`).
 *
 * See `GlazeCombobox` for the glaze-specialised wrapper that fills in the
 * brand / displayName / thumbnail defaults.
 */

import {
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { springs } from "../config/animations";
import { useIsMobile } from "../hooks/useIsMobile";
import { Check, ChevronDown, Close, Palette } from "./Icons";
import { PickerSurface } from "./PickerSurface";
import { SearchInput } from "./SearchInput";

type Tone = "sage" | "terracotta";

const TONE_CHEVRON_OPEN_CLASS: Record<Tone, string> = {
  sage: "text-sage-500 dark:text-sage-400",
  terracotta: "text-terracotta-500 dark:text-terracotta-400",
};

const TONE_CHECK_CLASS: Record<Tone, string> = {
  sage: "text-sage-600 dark:text-sage-400",
  terracotta: "text-terracotta-600 dark:text-terracotta-400",
};

const TONE_FOCUS_CLASS: Record<Tone, string> = {
  sage: "focus:ring-2 focus:ring-sage-500/50 focus:border-sage-400",
  terracotta:
    "focus:ring-2 focus:ring-terracotta-500/50 focus:border-terracotta-400",
};

export interface ComboboxProps<T extends { id: string }> {
  items: T[];
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;

  getKey?: (item: T) => string;
  getLabel: (item: T) => string;
  getSearchHaystack?: (item: T) => string;
  groupBy?: (item: T) => string;

  mode?: "single" | "multi";
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: (query: string) => string;
  noItemsMessage?: string;

  renderTriggerValue?: (
    selectedItems: T[],
    args: { placeholder: string },
  ) => ReactNode;
  renderRow?: (
    item: T,
    state: { isSelected: boolean; isActive: boolean },
  ) => ReactNode;

  fullWidth?: boolean;
  tone?: Tone;
  clearable?: boolean;
  disabled?: boolean;

  id?: string;
  label?: string;
  helpText?: string;
  error?: string;
  /** Aria-label when no visual `label` is provided. */
  ariaLabel?: string;
  className?: string;
  /** Show the search input in the panel header. Default true. Set to
   *  false for short option lists (e.g. 1–5 coats) where search is
   *  noise rather than helpful. */
  searchable?: boolean;
  /** Extra classes appended to the panel (bottom sheet / popover /
   *  centered modal) so callers can tweak the panel’s size for short
   *  option lists. Forwarded verbatim to `PickerSurface`. */
  panelClassName?: string;
  /** Override the trigger CSS classes when the default doesn't fit. */
  triggerClassName?: string;
}

export function Combobox<T extends { id: string }>({
  items,
  value,
  onChange,
  getKey = (item: T) => item.id,
  getLabel,
  getSearchHaystack,
  groupBy,
  mode = "single",
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = (q) => `No results for "${q}"`,
  noItemsMessage = "Nothing to choose from yet.",
  renderTriggerValue,
  renderRow,
  fullWidth = false,
  tone = "sage",
  clearable = false,
  disabled = false,
  id,
  label,
  helpText,
  error,
  ariaLabel,
  className = "",
  searchable = true,
  panelClassName,
  triggerClassName,
}: ComboboxProps<T>) {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();

  const reactId = useId();
  const triggerId = id ?? `combobox-${reactId}`;
  const listboxId = `${triggerId}-listbox`;
  const labelId = label ? `${triggerId}-label` : undefined;
  const helpId = helpText ? `${triggerId}-help` : undefined;
  const errorId = error ? `${triggerId}-error` : undefined;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // For multi-select we stage selection locally until "Apply".
  const externalSelected = useMemo<string[]>(
    () =>
      value == null ? [] : Array.isArray(value) ? value : [value as string],
    [value],
  );
  const [stagedSelected, setStagedSelected] =
    useState<string[]>(externalSelected);

  // Resync staged when an `isOpen` cycle starts or external value updates.
  useEffect(() => {
    if (!isOpen) setStagedSelected(externalSelected);
  }, [isOpen, externalSelected]);

  const activeSelected = mode === "multi" ? stagedSelected : externalSelected;

  // --- Search filter + grouping -------------------------------------------------
  const haystackFor = useCallback(
    (item: T) =>
      (getSearchHaystack ? getSearchHaystack(item) : getLabel(item))
        .toLowerCase(),
    [getSearchHaystack, getLabel],
  );

  const filteredGroups = useMemo<{ group: string; items: T[] }[]>(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? items.filter((item) => haystackFor(item).includes(q))
      : items;

    if (!groupBy) return [{ group: "", items: matched }];

    const buckets = new Map<string, T[]>();
    for (const item of matched) {
      const g = groupBy(item);
      const arr = buckets.get(g);
      if (arr) arr.push(item);
      else buckets.set(g, [item]);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, groupItems]) => ({ group, items: groupItems }));
  }, [items, search, haystackFor, groupBy]);

  const flatFiltered = useMemo(
    () => filteredGroups.flatMap((g) => g.items),
    [filteredGroups],
  );

  // --- Open / close orchestration ----------------------------------------------
  const openPanel = useCallback(
    (seedSearch?: string) => {
      if (disabled) return;
      if (seedSearch != null) setSearch(seedSearch);
      setIsOpen(true);
    },
    [disabled],
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    // Focus is restored to the trigger by PickerSurface’s focus-tracking.
  }, []);

  // When opening, seed the keyboard cursor at the (first) selected row.
  useEffect(() => {
    if (!isOpen) return;
    const seed = activeSelected[0] ?? flatFiltered[0]?.id ?? null;
    setActiveKey(seed);
    // Defer focusing the search input so the panel is mounted first.
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Keep the active row visible as the cursor moves.
  useEffect(() => {
    if (!isOpen || !activeKey) return;
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeKey]);

  // Clamp activeKey when the filtered list collapses.
  useEffect(() => {
    if (!isOpen) return;
    if (
      activeKey != null &&
      !flatFiltered.some((item) => getKey(item) === activeKey)
    ) {
      setActiveKey(flatFiltered[0] ? getKey(flatFiltered[0]) : null);
    }
  }, [isOpen, activeKey, flatFiltered, getKey]);

  // Esc clears the search first, then closes (Combobox-specific keystroke).
  // PickerSurface handles a vanilla Esc-to-close, so this layer intercepts
  // first and stops propagation when there's a non-empty search to clear.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (search.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        setSearch("");
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen, search]);

  // --- Selection helpers --------------------------------------------------------
  const isSelected = useCallback(
    (item: T) => activeSelected.includes(getKey(item)),
    [activeSelected, getKey],
  );

  const handleSelect = useCallback(
    (item: T) => {
      const key = getKey(item);
      if (mode === "multi") {
        setStagedSelected((prev) =>
          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );
        return;
      }
      onChange(key);
      closePanel();
    },
    [getKey, mode, onChange, closePanel],
  );

  const handleApplyMulti = useCallback(() => {
    onChange(stagedSelected);
    closePanel();
  }, [stagedSelected, onChange, closePanel]);

  const handleCancelMulti = useCallback(() => {
    setStagedSelected(externalSelected);
    closePanel();
  }, [externalSelected, closePanel]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(mode === "multi" ? [] : null);
      if (mode === "multi") setStagedSelected([]);
    },
    [mode, onChange],
  );

  // --- Keyboard navigation inside the panel -------------------------------------
  const moveActive = useCallback(
    (delta: number) => {
      if (flatFiltered.length === 0) return;
      const idx = flatFiltered.findIndex((item) => getKey(item) === activeKey);
      const nextIdx =
        idx < 0
          ? delta > 0
            ? 0
            : flatFiltered.length - 1
          : (idx + delta + flatFiltered.length) % flatFiltered.length;
      setActiveKey(getKey(flatFiltered[nextIdx]));
    },
    [activeKey, flatFiltered, getKey],
  );

  const handlePanelKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        if (flatFiltered[0]) setActiveKey(getKey(flatFiltered[0]));
      } else if (e.key === "End") {
        e.preventDefault();
        const last = flatFiltered[flatFiltered.length - 1];
        if (last) setActiveKey(getKey(last));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatFiltered.find((i) => getKey(i) === activeKey);
        if (item) handleSelect(item);
      }
    },
    [moveActive, flatFiltered, activeKey, getKey, handleSelect],
  );

  // Trigger key handler (when closed).
  const handleTriggerKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === " "
      ) {
        e.preventDefault();
        openPanel();
      } else if (
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        /[\w\s\-.,]/.test(e.key)
      ) {
        e.preventDefault();
        openPanel(e.key);
      }
    },
    [disabled, openPanel],
  );

  // --- Trigger content ----------------------------------------------------------
  const selectedItems = useMemo(
    () => items.filter((item) => activeSelected.includes(getKey(item))),
    [items, activeSelected, getKey],
  );

  const triggerContent = useMemo<ReactNode>(() => {
    if (selectedItems.length === 0) {
      return (
        <span className="text-clay-500 dark:text-clay-400 truncate">
          {placeholder}
        </span>
      );
    }
    if (renderTriggerValue) {
      return renderTriggerValue(selectedItems, { placeholder });
    }
    if (mode === "multi") {
      return (
        <span className="truncate text-clay-800 dark:text-clay-100">
          {selectedItems.length} selected
        </span>
      );
    }
    return (
      <span className="truncate text-clay-800 dark:text-clay-100">
        {getLabel(selectedItems[0])}
      </span>
    );
  }, [selectedItems, renderTriggerValue, mode, getLabel, placeholder]);

  // --- Row renderer -------------------------------------------------------------
  const defaultRenderRow = useCallback(
    (item: T, state: { isSelected: boolean; isActive: boolean }) => (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-sm font-medium text-clay-800 dark:text-clay-100 truncate flex-1">
          {getLabel(item)}
        </span>
        {state.isSelected && (
          <Check className={`w-5 h-5 ${TONE_CHECK_CLASS[tone]}`} />
        )}
      </div>
    ),
    [getLabel, tone],
  );

  const rowRenderer = renderRow ?? defaultRenderRow;

  // --- Panel inner --------------------------------------------------------------
  // When the picker has neither a search input nor a visible title, the
  // header is empty noise. Skip rendering it entirely on mobile (the
  // drag-handle pill + tap-outside are enough dismiss affordances); on
  // desktop there's no X button to render either, so the header is
  // skipped there too.
  const hasHeaderContent = searchable || !!label;

  const renderPanelBody = () => (
    <div
      className="flex flex-col h-full min-h-0"
      onKeyDown={handlePanelKeyDown}
    >
      {/* Header */}
      {hasHeaderContent && (
        <div
          className={`flex items-center gap-2 px-3 py-3 ${searchable ? "border-b border-clay-200 dark:border-earth-600" : ""} bg-white dark:bg-earth-800 ${isMobile ? "" : "sticky top-0 z-10"}`}
        >
          {searchable && (
            <div className="flex-1 min-w-0">
              <SearchInput
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-controls={listboxId}
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {!searchable && label && (
            <span
              id={`${triggerId}-panel-title`}
              className="flex-1 text-sm font-medium text-clay-700 dark:text-clay-300"
            >
              {label}
            </span>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => closePanel()}
              className="p-2 rounded-lg text-clay-500 dark:text-clay-400 hover:bg-clay-100 dark:hover:bg-earth-700 focus-ring"
              aria-label="Close picker"
            >
              <Close size="lg" />
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div
        id={listboxId}
        role="listbox"
        aria-multiselectable={mode === "multi"}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-clay-500 dark:text-clay-400">
            {noItemsMessage}
          </p>
        ) : flatFiltered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Palette className="w-8 h-8 mx-auto mb-3 text-clay-400 dark:text-clay-500" />
            <p className="text-sm text-clay-500 dark:text-clay-400">
              {emptyMessage(search)}
            </p>
          </div>
        ) : (
          filteredGroups.map(({ group, items: groupItems }) => (
            <div key={group || "all"} className="py-1">
              {groupBy && group && (
                <div className="sticky top-0 z-[1] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-clay-500 dark:text-clay-400 bg-white/85 dark:bg-earth-800/85 backdrop-blur-sm">
                  {group}
                </div>
              )}
              {groupItems.map((item) => {
                const key = getKey(item);
                const selected = isSelected(item);
                const active = activeKey === key;
                return (
                  <div
                    key={key}
                    ref={active ? activeRowRef : undefined}
                    id={`${listboxId}-opt-${key}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveKey(key)}
                    onClick={() => handleSelect(item)}
                    className={[
                      "mx-2 my-0.5 rounded-lg px-3 cursor-pointer transition-colors duration-150",
                      "min-h-[44px] md:min-h-[44px] flex items-center",
                      selected
                        ? "bg-sage-100 dark:bg-sage-900/60 ring-1 ring-sage-400 dark:ring-sage-500"
                        : "bg-transparent hover:bg-sage-100/40 dark:hover:bg-sage-900/20",
                      active && !selected
                        ? "ring-1 ring-sage-500 ring-inset"
                        : "",
                      active && selected
                        ? "ring-1 ring-sage-500 ring-inset"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3 py-2 flex-1">
                      {rowRenderer(item, {
                        isSelected: selected,
                        isActive: active,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Multi-select footer */}
      {mode === "multi" && (
        <div className="px-4 py-3 border-t border-clay-200 dark:border-earth-600 bg-clay-50 dark:bg-earth-700/60 flex items-center justify-between gap-3">
          <span
            className="text-sm text-clay-600 dark:text-clay-400"
            aria-live="polite"
          >
            {stagedSelected.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelMulti}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-clay-700 dark:text-clay-300 hover:bg-clay-100 dark:hover:bg-earth-700 focus-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyMulti}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-sage-600 text-white hover:bg-sage-700 focus-ring"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // --- Layout: trigger + panel --------------------------------------------------
  const hasValue = activeSelected.length > 0;
  const showClear = clearable && hasValue && !disabled;

  const triggerBase =
    "group inline-flex items-center gap-2 rounded-lg border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-800 text-clay-800 dark:text-clay-200 px-3 py-2 pr-9 min-h-[44px] transition-shadow duration-150 text-left focus:outline-none";
  const triggerWidth = fullWidth ? "w-full" : "";
  const triggerError = error ? "border-red-400 dark:border-red-500" : "";
  const triggerDisabled = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <div className={`${fullWidth ? "block w-full" : "inline-block"} ${className}`}>
      {label && (
        <label
          id={labelId}
          htmlFor={triggerId}
          className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
        >
          {label}
        </label>
      )}

      <div className={`relative ${fullWidth ? "w-full" : ""}`}>
        <motion.button
          ref={triggerRef}
          id={triggerId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && activeKey ? `${listboxId}-opt-${activeKey}` : undefined
          }
          aria-labelledby={labelId}
          aria-label={!label ? ariaLabel : undefined}
          aria-describedby={
            [helpId, errorId].filter(Boolean).join(" ") || undefined
          }
          aria-invalid={!!error}
          disabled={disabled}
          onClick={() => (isOpen ? closePanel() : openPanel())}
          onKeyDown={handleTriggerKeyDown}
          animate={
            reduceMotion ? { scale: 1 } : { scale: isOpen ? 1.01 : 1 }
          }
          transition={springs.quick}
          className={[
            triggerBase,
            triggerWidth,
            triggerError,
            triggerDisabled,
            TONE_FOCUS_CLASS[tone],
            triggerClassName ?? "",
          ].join(" ")}
        >
          <span className="flex-1 min-w-0 flex items-center gap-2 truncate">
            {triggerContent}
          </span>

          {showClear && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(mode === "multi" ? [] : null);
                  if (mode === "multi") setStagedSelected([]);
                }
              }}
              className="p-0.5 rounded text-clay-400 hover:text-clay-700 dark:text-clay-500 dark:hover:text-clay-200"
            >
              <Close />
            </span>
          )}

          <span
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 inline-flex transition-colors duration-150 ${isOpen ? TONE_CHEVRON_OPEN_CLASS[tone] : "text-clay-500 dark:text-clay-400"}`}
            aria-hidden
          >
            <motion.span
              className="inline-flex"
              initial={false}
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={reduceMotion ? { duration: 0 } : springs.quick}
            >
              <ChevronDown />
            </motion.span>
          </span>
        </motion.button>

        {helpText && !error && (
          <p
            id={helpId}
            className="mt-1 text-xs text-clay-500 dark:text-clay-400"
          >
            {helpText}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}

        {/* Panel — rendered through the shared PickerSurface. */}
        <PickerSurface
          isOpen={isOpen}
          onClose={() => closePanel()}
          mode="anchored"
          triggerRef={triggerRef}
          ariaLabelledBy={labelId}
          ariaLabel={!label ? ariaLabel : undefined}
          panelClassName={panelClassName}
        >
          {renderPanelBody()}
        </PickerSurface>
      </div>
    </div>
  );
}
