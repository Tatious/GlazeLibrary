/**
 * Unified icon system.
 *
 * Every icon renders through `IconBase`, which fixes sizing tokens,
 * tone tokens and stroke defaults so the whole UI shares one icon
 * language. Add new glyphs at the bottom of this file so they pick up
 * the same conventions automatically.
 *
 * - `size`   maps to a Tailwind `w-* h-*` pair (sm = 14px, md = 16px, ...)
 * - `tone`   maps to a paired light/dark text color, or to `currentColor`
 * - `filled` flips stroke icons (Heart, Star) to their solid variant
 *
 * Default size is `md` (w-4 h-4) — the dominant inline size in the app.
 * Default tone is `current` so an icon inherits the surrounding text
 * color (button, link, heading) unless told otherwise.
 */

import type { ReactNode, SVGAttributes } from "react";

// ─── Size + tone tokens ───────────────────────────────────────────────────

export const ICON_SIZE_CLASSES = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
  xl: "w-6 h-6",
  "2xl": "w-8 h-8",
  "3xl": "w-10 h-10",
  "4xl": "w-16 h-16",
} as const;

export type IconSize = keyof typeof ICON_SIZE_CLASSES;

/**
 * Tone tokens. Each tone resolves to a paired light/dark text color so
 * icons read consistently across the app's terracotta/clay palette.
 *
 * - `current`     — inherit from parent (`<button>`, heading, link)
 * - `muted`       — secondary affordances (icon next to dimmed label)
 * - `subtle`      — disabled / empty-state placeholders
 * - `default`     — neutral interactive surfaces
 * - `strong`      — body text emphasis
 * - `active`      — active selection / favorite-on
 * - `destructive` — delete / remove
 * - `success`     — owned / completed / moss accent
 * - `badge`       — official / verified sage accent
 */
export const ICON_TONE_CLASSES = {
  current: "",
  muted: "text-clay-400 dark:text-earth-500",
  subtle: "text-clay-300 dark:text-earth-600",
  default: "text-clay-500 dark:text-clay-400",
  strong: "text-clay-700 dark:text-clay-200",
  active: "text-terracotta-500 dark:text-terracotta-400",
  destructive: "text-red-500 dark:text-red-400",
  success: "text-moss-500 dark:text-moss-400",
  badge: "text-sage-500 dark:text-sage-400",
} as const;

export type IconTone = keyof typeof ICON_TONE_CLASSES;

export interface IconProps
  extends Omit<
    SVGAttributes<SVGSVGElement>,
    "fill" | "stroke" | "children" | "viewBox"
  > {
  /** Preset size token. Defaults to `md` (w-4 h-4). */
  size?: IconSize;
  /** Paired light/dark text color. Defaults to `current` (inherit). */
  tone?: IconTone;
  /**
   * Render the icon's filled variant. Only meaningful for icons whose
   * default is a stroked outline (Heart, Star). Always-filled icons
   * (Badge) and always-stroked icons (Chevron) ignore this.
   */
  filled?: boolean;
  /** Override stroke width for stroked icons. Defaults to 2. */
  strokeWidth?: number;
  /** Escape hatch to add extra classes (positioning, colors, ...). */
  className?: string;
}

interface IconBaseProps extends IconProps {
  /**
   * Glyph contents. `IconBase` fixes viewBox, fill, stroke, linecap and
   * linejoin defaults so each icon component only supplies its path data.
   */
  children: ReactNode;
  /**
   * Icons that are always filled (Badge) pass `defaultFilled` instead of
   * relying on the consumer-controlled `filled` prop.
   */
  defaultFilled?: boolean;
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Treat any `w-*` / `h-*` in className as an explicit size override. */
const SIZE_OVERRIDE_RE = /(?:^|\s)(?:w|h)-/;

export function IconBase({
  size = "md",
  tone = "current",
  filled,
  defaultFilled = false,
  strokeWidth = 2,
  className,
  children,
  "aria-hidden": ariaHidden,
  ...rest
}: IconBaseProps) {
  const isFilled = filled ?? defaultFilled;
  const sizeClass = className && SIZE_OVERRIDE_RE.test(className)
    ? ""
    : ICON_SIZE_CLASSES[size];
  return (
    <svg
      viewBox="0 0 24 24"
      fill={isFilled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden ?? true}
      className={cn(sizeClass, ICON_TONE_CLASSES[tone], className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

// ─── Navigation / arrows ──────────────────────────────────────────────────

export function ChevronUp(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 15l7-7 7 7" />
    </IconBase>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 9l-7 7-7-7" />
    </IconBase>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 19l-7-7 7-7" />
    </IconBase>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 5l7 7-7 7" />
    </IconBase>
  );
}

// ─── Core actions ─────────────────────────────────────────────────────────

export function Plus(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4v16m8-8H4" />
    </IconBase>
  );
}

export function Close(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 18L18 6M6 6l12 12" />
    </IconBase>
  );
}
export { Close as X };

export function Check(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 13l4 4L19 7" />
    </IconBase>
  );
}

export function GripVertical(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function Pencil(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </IconBase>
  );
}
export { Pencil as Edit };

export function Trash(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </IconBase>
  );
}
export { Trash as Delete };

export function Search(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </IconBase>
  );
}

export function Upload(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </IconBase>
  );
}

export function Expand(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </IconBase>
  );
}
export { Expand as ArrowsOut };

// ─── Symbolic / state toggles ─────────────────────────────────────────────

export function Heart(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </IconBase>
  );
}

export function Star(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </IconBase>
  );
}

export function Tag(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </IconBase>
  );
}

export function Ban(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </IconBase>
  );
}

/**
 * Filled 8-pointed rosette with a check punched through — the
 * "official" / verified manufacturer-test indicator. Tips at r=9,
 * valleys at r=6, all measured from the viewBox center (12,12).
 */
export function Badge(props: IconProps) {
  return (
    <IconBase {...props} defaultFilled>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3L14.3 6.5L18.4 5.6L17.5 9.7L21 12L17.5 14.3L18.4 18.4L14.3 17.5L12 21L9.7 17.5L5.6 18.4L6.5 14.3L3 12L6.5 9.7L5.6 5.6L9.7 6.5ZM15.61 10.186a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25z"
      />
    </IconBase>
  );
}
export { Badge as CheckBadge };

// ─── Containers / domain ──────────────────────────────────────────────────

export function Folder(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </IconBase>
  );
}

/** Heroicons archive-box — represents an admin's shared glaze inventory. */
export function Inventory(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </IconBase>
  );
}

/**
 * Variant used in Discover's "no inventory yet" empty state, where the
 * archive box has a download arrow stacked on it.
 */
export function InventoryDownload(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </IconBase>
  );
}

/** Wireframe cube — used as the "piece" / pottery vessel icon. */
export function Pottery(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </IconBase>
  );
}
export { Pottery as Cube };

/** Stacked layers — the "combinations / combos" affordance. */
export function Layers(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </IconBase>
  );
}
export { Layers as Combos };

/** Open inbox tray — used as the empty-collection placeholder. */
export function Inbox(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </IconBase>
  );
}

// ─── Media ────────────────────────────────────────────────────────────────

export function Camera(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </IconBase>
  );
}

/** Mountain-in-frame image icon — empty-photo placeholder. */
export function Image(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </IconBase>
  );
}

/** Heroicons photo (more detailed) — used in CollectionsPage previews. */
export function Photo(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </IconBase>
  );
}

// ─── Palette (domain-specific clay/glaze icon) ────────────────────────────

/**
 * Ceramic palette — the glaze metaphor used as a marker for glaze
 * affordances (combobox empty state, discover empty state, collection
 * actions row).
 */
export function Palette(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </IconBase>
  );
}

/**
 * Glaze jar with a brush dipping in — the "this is about glaze"
 * affordance marker (collection actions row, piece inspo placeholder).
 *
 * Geometry: open-top jar walls + rounded bottom; horizontal meniscus
 * inside; brush handle exits through the rim opening at a steep angle
 * up and to the right; bristle is a wide perpendicular stroke that
 * straddles the meniscus so the brush reads as submerged.
 */
export function GlazeSwatch(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 8v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
      <path d="M8 11h8" />
      <path d="M13 13l4-9" />
      <path d="M11.2 12.7l3.6 1.6" />
    </IconBase>
  );
}

// ─── People + commerce + document ────────────────────────────────────────

export function User(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </IconBase>
  );
}

export function Document(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </IconBase>
  );
}

export function Shop(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </IconBase>
  );
}
export { Shop as Cart };

export function Eye(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function EyeOff(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 4.22-5.06" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.86 19.86 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </IconBase>
  );
}

// ─── Pottery stages (clay → bisque → fired) ───────────────────────────────

export function Droplet(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3c0 0-6 8-6 12a6 6 0 0012 0c0-4-6-12-6-12z" />
    </IconBase>
  );
}

export function Flame(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    </IconBase>
  );
}

export function Sparkles(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </IconBase>
  );
}

// ─── Reorder ──────────────────────────────────────────────────────────────

/**
 * Two vertical arrows pointing opposite directions — the "swap" / reorder
 * affordance (e.g. flip a glaze plan's base and top layers).
 */
export function Swap(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l-3 3m3-3l3 3" />
    </IconBase>
  );
}
