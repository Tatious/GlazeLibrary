/**
 * `<Select>` — convenience wrapper around `<Combobox>` that takes
 * `<option>` children (matching the native `<select>` API) so callers can
 * keep their existing JSX shape. Renders as an anchored popover on
 * desktop, a slide sheet on mobile, a centered modal on landscape phones
 * — all via the shared `PickerSurface` plumbing inside `Combobox`. Used
 * for short option lists (coats counts, etc.); reach for `<Combobox>`
 * directly when you need search, grouping, or rich row rendering.
 *
 * Search is off by default since the option lists here are short
 * (typically 5 numeric choices); pass `searchable` to opt back in.
 */

import { Children, isValidElement, type OptionHTMLAttributes, type ReactNode } from "react";
import { Combobox } from "./Combobox";

type Tone = "sage" | "terracotta";

interface SelectProps {
  children: ReactNode;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  /** Visible field label rendered above the trigger. */
  label?: string;
  /** Falls back here when there is no `label`. */
  ariaLabel?: string;
  /** Shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Stretch the trigger to fill its container. */
  fullWidth?: boolean;
  /** Surface tone for the focus ring + chevron. */
  tone?: Tone;
  /** Show a search input in the panel header. Default false. */
  searchable?: boolean;
  /** Extra classes for the trigger. */
  className?: string;
  /** DOM id used by an external `<label htmlFor>`. */
  id?: string;
  /** Optional `<title>` tooltip on the trigger wrapper. */
  title?: string;
}

interface Item {
  id: string;
  label: string;
}

// React renders mixed JSX children like `{n}×` as an array of nodes
// (`[2, "×"]`), so a naive `String(children)` would yield `"2,×"`. We
// flatten by joining string-coercible parts so the rendered label matches
// what the user wrote in source.
function childToText(node: ReactNode): string {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childToText).join("");
  return String(node);
}

// Flatten `<option>` (and `<optgroup><option>...</optgroup>`) children
// into a list the Combobox can consume. We only need value + label here —
// any other native-`<option>` semantics aren't supported.
function extractOptions(children: ReactNode): Item[] {
  const items: Item[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "optgroup") {
      items.push(...extractOptions(child.props.children));
      return;
    }
    if (child.type === "option") {
      const props = child.props as OptionHTMLAttributes<HTMLOptionElement> & {
        children?: ReactNode;
      };
      const value = String(props.value ?? "");
      const label = childToText(props.children) || value;
      items.push({ id: value, label });
    }
  });
  return items;
}

export function Select({
  children,
  value,
  onChange,
  label,
  ariaLabel,
  placeholder = "Select…",
  fullWidth = false,
  tone = "sage",
  searchable = false,
  className,
  id,
  title,
}: SelectProps) {
  const items = extractOptions(children);
  return (
    <div title={title}>
      <Combobox<Item>
        items={items}
        value={value || null}
        onChange={(next) => {
          const v = typeof next === "string" ? next : "";
          onChange({ target: { value: v } });
        }}
        getLabel={(item) => item.label}
        getSearchHaystack={(item) => item.label}
        mode="single"
        placeholder={placeholder}
        fullWidth={fullWidth}
        tone={tone}
        searchable={searchable}
        id={id}
        label={label}
        ariaLabel={ariaLabel}
        triggerClassName={className}
        // `!max-h-fit` overrides the bottom sheet's default `max-h-[85dvh]`
        // so a short option list (typically 5 rows) gets a compact sheet
        // sized to its content rather than a near-full-screen takeover.
        // Tailwind's `!` prefix forces the rule's specificity to win even
        // though it sits later in the className concat.
        panelClassName="!max-h-fit"
        // Use the muted picker-family color for the selected value so a
        // <Select> reads alongside <Combobox> placeholders (e.g. the
        // Glaze Plan add-row's coats next to the glaze picker) without
        // popping in a different weight/tone.
        renderTriggerValue={(selected) => (
          <span className="truncate text-sm text-clay-500 dark:text-clay-400">
            {selected[0]?.label}
          </span>
        )}
      />
    </div>
  );
}
