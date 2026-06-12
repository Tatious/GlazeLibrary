/**
 * `<PickerSurface>` — the shared overlay shell used by every dropdown,
 * picker, dialog, and bottom sheet in the app.
 *
 * Two layout modes:
 *   - `mode="anchored"` + `triggerRef` → desktop popover anchored under
 *     (or above) the trigger. Falls back to bottom-sheet on mobile so
 *     the popover doesn't compete with the on-screen keyboard.
 *   - `mode="dialog"` (default) → desktop & landscape-phone centered
 *     modal; mobile-portrait bottom slide-sheet.
 *
 * # Architecture
 *
 * The dialog/sheet modes render a single full-viewport overlay
 * (`position: fixed inset-0`) via `react-remove-scroll`, which isolates
 * scrolling to the overlay. On touch devices we ALSO lock the body with
 * `position: fixed` (see the body-lock effect): this stops the page from
 * scrolling out from under the modal when the iOS keyboard opens, and it
 * forces iOS to scroll the focused input into view WITHIN the panel's own
 * `overflow-y: auto` body rather than scrolling the document. We do not try
 * to track the visual viewport to pin the panel above the keyboard — that
 * proved fragile on real iOS (per-field shifting, dismiss bounce); the body
 * lock + scrollable panel body is the robust, predictable behavior instead.
 *
 * The panel sits inside an `overflow-y: auto` scroll container so long
 * panel content (e.g. the glaze picker with hundreds of rows) scrolls
 * inside the overlay, never the page.
 *
 * Anchored mode is different: the popover sits on top of the page, but
 * by design we let the page receive clicks outside the popover (e.g. to
 * click another row to focus it). It uses a small `pointer-events: none`
 * shell with the panel re-enabling them.
 */

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RemoveScroll } from "react-remove-scroll";
import { fadeInScale } from "../config/animations";
import { springs } from "../config/animations";
import { useIsMobile } from "../hooks/useIsMobile";

type SurfaceMode = "anchored" | "dialog";

interface PanelPosition {
  top: number;
  left: number;
  width: number;
  /** Where the panel attaches to the trigger — drives `transform-origin`. */
  origin: "top" | "bottom";
}

export interface PickerSurfaceProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** `anchored` requires `triggerRef`. Defaults to `dialog`. */
  mode?: SurfaceMode;
  /** Required for `mode="anchored"`. */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Width policy for desktop dialog mode. Ignored on mobile / anchored. */
  dialogSize?: "sm" | "md" | "lg";
  /** Override the anchored popover's min/max width in px. */
  anchoredMinWidth?: number;
  anchoredMaxWidth?: number;
  /** Pass `false` to suppress focus return when the surface closes itself. */
  returnFocusOnClose?: boolean;
  /** ARIA label for the dialog when no in-content title is provided. */
  ariaLabel?: string;
  /** ID of the in-content title (overrides `ariaLabel`). */
  ariaLabelledBy?: string;
  /** Optional extra class on the rendered panel. */
  panelClassName?: string;
}

const DIALOG_WIDTHS: Record<NonNullable<PickerSurfaceProps["dialogSize"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

const PANEL_GAP = 4;
const VIEWPORT_PADDING = 16;
const ANCHORED_MAX_HEIGHT_FACTOR = 0.6;
const ANCHORED_MAX_HEIGHT_CAP = 480;
const ANCHORED_MIN_WIDTH = 280;
const ANCHORED_MAX_WIDTH = 360;

export function PickerSurface({
  isOpen,
  onClose,
  children,
  mode = "dialog",
  triggerRef,
  dialogSize = "md",
  anchoredMinWidth = ANCHORED_MIN_WIDTH,
  anchoredMaxWidth = ANCHORED_MAX_WIDTH,
  returnFocusOnClose = true,
  ariaLabel,
  ariaLabelledBy,
  panelClassName,
}: PickerSurfaceProps) {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // `anchored` mode collapses to `dialog` (bottom sheet) on mobile —
  // popovers don't fit and would compete with the keyboard.
  const useAnchored = mode === "anchored" && !isMobile;
  const isBottomSheet = !useAnchored && isMobile;
  const isCenteredDialog = !useAnchored && !isMobile;

  // --- Anchored popover positioning -----------------------------------------
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const recompute = useCallback(() => {
    if (!useAnchored || !triggerRef?.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const maxHeight = Math.min(
      window.innerHeight * ANCHORED_MAX_HEIGHT_FACTOR,
      ANCHORED_MAX_HEIGHT_CAP,
    );
    const width = Math.min(
      Math.max(rect.width, anchoredMinWidth),
      Math.min(anchoredMaxWidth, window.innerWidth - 2 * VIEWPORT_PADDING),
    );
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const wantsFlip =
      spaceBelow < Math.min(maxHeight, 240) && spaceAbove > spaceBelow;

    const top = wantsFlip
      ? Math.max(VIEWPORT_PADDING, rect.top - PANEL_GAP - maxHeight)
      : rect.bottom + PANEL_GAP;

    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_PADDING) {
      left = Math.max(
        VIEWPORT_PADDING,
        window.innerWidth - width - VIEWPORT_PADDING,
      );
    }

    setPosition({
      top,
      left,
      width,
      origin: wantsFlip ? "bottom" : "top",
    });
  }, [useAnchored, triggerRef, anchoredMinWidth, anchoredMaxWidth]);

  useLayoutEffect(() => {
    if (!isOpen || !useAnchored) return;
    recompute();
    const handle = () => recompute();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [isOpen, useAnchored, recompute]);

  // --- Esc to close ---------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // --- iOS / touch body-scroll lock (position: fixed) ----------------------
  // `<RemoveScroll>` (in the render) locks the body with `overflow:
  // hidden`. That stops *user-initiated* scrolling, but NOT iOS Safari's
  // *programmatic* "scroll the focused input into view" when the soft
  // keyboard opens — that still scrolls the document, dragging the page
  // out from behind our fixed overlay. `overflow: hidden` cannot prevent
  // it; only removing the body from the scroll flow with `position:
  // fixed` does (the technique react-aria's `usePreventScroll` and vaul
  // use). We snapshot the scroll offset, fix the body, then restore both
  // the styles and the scroll position on close.
  //
  // Touch devices only: desktop has no virtual keyboard, and position:
  // fixed there would fight RemoveScroll's scrollbar-gutter compensation
  // and cause a horizontal layout shift on modal open.
  useEffect(() => {
    if (!isOpen || useAnchored) return;
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    if (!isTouch) return;

    const scrollY = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, useAnchored]);

  // --- Visual viewport / iOS keyboard --------------------------------------
  // We intentionally do NOT track the visual viewport to pin the panel above
  // the keyboard. Many attempts at that (transform lifts, vv-sized frames)
  // produced per-field shifting and dismiss bounces on real iOS, because iOS
  // pans the layout viewport by a different amount for each focused field and
  // emits inconsistent geometry mid-animation. Instead we rely on the proven,
  // predictable combination below:
  //   • `<RemoveScroll>` isolates scrolling to the overlay.
  //   • the `position: fixed` body lock (above) stops the page from scrolling
  //     out from under the modal, which also forces iOS to scroll the focused
  //     input into view WITHIN the panel's own `overflow-y: auto` body.
  // So when the keyboard opens, the panel stays put (full-screen overlay, the
  // keyboard just overlays its lower part) and iOS brings the focused field
  // into view by scrolling the panel body — no JS, no shifting, no bounce.

  // --- Anchored-only click-outside -----------------------------------------
  // Dialog mode uses an explicit backdrop element with its own onClick;
  // anchored mode doesn't render a backdrop (the page stays interactive),
  // so we need a window listener to detect clicks outside.
  useEffect(() => {
    if (!isOpen || !useAnchored) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isOpen, useAnchored, triggerRef, onClose]);

  // --- Focus restoration ---------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      lastFocusedRef.current =
        (document.activeElement as HTMLElement | null) ?? null;
    } else if (returnFocusOnClose && lastFocusedRef.current) {
      const target = lastFocusedRef.current;
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
      lastFocusedRef.current = null;
    }
  }, [isOpen, returnFocusOnClose]);

  if (typeof document === "undefined") return null;

  // ─── Anchored popover ──────────────────────────────────────────────────
  // Page stays interactive underneath; we render a small panel positioned
  // by `recompute()`. No backdrop, no body lock — clicks outside go to
  // the page (intentional) and are also caught by the window listener
  // above to close the popover.
  if (useAnchored) {
    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal={false}
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy}
            variants={fadeInScale}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduceMotion ? { duration: 0 } : springs.gentle}
            style={
              position
                ? {
                    position: "fixed",
                    top: position.top,
                    left: position.left,
                    width: position.width,
                    maxHeight: `min(${ANCHORED_MAX_HEIGHT_FACTOR * 100}vh, ${ANCHORED_MAX_HEIGHT_CAP}px)`,
                    transformOrigin:
                      position.origin === "top" ? "top center" : "bottom center",
                    zIndex: 50,
                  }
                : {
                    position: "fixed",
                    visibility: "hidden",
                    zIndex: 50,
                  }
            }
            className={[
              "rounded-xl border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-800 shadow-xl flex flex-col overflow-hidden",
              panelClassName ?? "",
            ].join(" ")}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    );
  }

  // ─── Dialog / Bottom sheet ─────────────────────────────────────────────
  // `<RemoveScroll>` locks scrolling everywhere except inside the element
  // it renders — it handles iOS touch, scrollbar-gutter compensation,
  // nested scroll areas, and portals (the same library Radix UI uses).
  //
  // We deliberately use plain `<div>`s with CSS keyframe entrance
  // animations (not framer-motion) here: RemoveScroll lazy-loads a
  // "sidecar" that remounts the subtree once on open, which reset
  // framer-motion's enter animation and left panels stuck at their
  // initial transform (scale 0.95 / translateY 100%). CSS animations
  // are immune to that remount.
  if (!isOpen) return null;

  return createPortal(
    // SINGLE fixed root (RemoveScroll renders this div), fixed to the full
    // layout viewport. On iOS the soft keyboard simply draws on top of its
    // lower portion — there is no gap and nothing to size to the keyboard.
    <RemoveScroll className="fixed inset-0 z-50">
      {/* Backdrop scrim — covers the whole overlay; tap to dismiss. */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 motion-safe:animate-overlay-in"
      />

      {/* Centered dialog (desktop / landscape phone). `pointer-events-none`
          on the centering layer so gaps fall through to the backdrop; the
          panel re-enables them. The panel body scrolls, so on the rare
          landscape-phone keyboard, iOS scrolls the focused input into view
          within it. */}
      {isCenteredDialog && (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy}
            className={[
              `pointer-events-auto w-full ${DIALOG_WIDTHS[dialogSize]} max-h-[85vh] rounded-xl border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-800 shadow-2xl flex flex-col overflow-hidden motion-safe:animate-dialog-in`,
              panelClassName ?? "",
            ].join(" ")}
          >
            {children}
          </div>
        </div>
      )}

      {/* Bottom sheet (mobile portrait), anchored to the bottom of the
          full-screen overlay. When the keyboard opens, the `position: fixed`
          body lock keeps the page from scrolling out from under the modal and
          forces iOS to scroll the focused input into view WITHIN the panel's
          own `overflow-y: auto` body — so the sheet itself stays put and the
          focused field is revealed without any viewport-tracking JS. */}
      {isBottomSheet && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy}
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          }}
          className={[
            "absolute left-0 right-0 bottom-0 rounded-t-xl bg-white dark:bg-earth-800 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden motion-safe:animate-sheet-in",
            panelClassName ?? "",
          ].join(" ")}
        >
          {/* Visual drag affordance. Dismiss via backdrop tap, the
              caller-supplied X button, or Esc. */}
          <div
            className="flex-shrink-0 pt-2 pb-3 flex justify-center"
            aria-hidden
          >
            <span className="block w-10 h-1 rounded-full bg-clay-400 dark:bg-clay-500" />
          </div>
          {children}
        </div>
      )}
    </RemoveScroll>,
    document.body,
  );
}
