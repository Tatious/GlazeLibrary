/**
 * Shared-element ("magic move") photo morph between a list card and its detail
 * hero — driven by the Web Animations API (no dependency).
 *
 * Two directions, two mechanisms — because the two ends are NOT symmetric:
 *
 *  • FORWARD (card → detail hero): the destination is the detail hero, a single,
 *    stable, non-virtualized element. It self-morphs — on mount it FLIP-animates
 *    its own box out of the clicked card's rect. `mode="wait"` in App.tsx mounts
 *    it only AFTER ScrollManager resets scroll, so it measures its true rect.
 *
 *  • REVERSE (detail hero → card): the destination is a card inside a WINDOW-
 *    VIRTUALIZED list whose scroll is restored ASYNCHRONOUSLY. That card unmounts
 *    / remounts as the virtualizer re-renders during the restore, so it cannot
 *    reliably self-morph (its animation gets torn down mid-flight — verified).
 *    Instead the outgoing hero spawns a FIXED-position overlay CLONE that morphs
 *    from the hero's rect to the card's KNOWN slot: the rect it was clicked from.
 *    Back-nav restores scroll to the same place, so the card returns to that rect
 *    and the overlay lands on it. The overlay is a document.body child, so
 *    virtualization and async scroll can't touch it.
 */
import { useLayoutEffect, useRef } from 'react';

/**
 * Shared morph identity. `kind` namespaces glazes vs combinations so a glaze and
 * a combination that happen to share an id can never morph into each other.
 */
export const imageMorphId = (kind: 'glaze' | 'combination', id: string) =>
  `${kind}-photo-${id}`;

type Rect = { top: number; left: number; width: number; height: number };

const measure = (el: HTMLElement): Rect => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FLIP_MS = 470;
const FLIP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const imgSrcOf = (el: HTMLElement): string => {
  const img = el.querySelector('img');
  return img ? img.currentSrc || img.src : '';
};

/** The photo element currently mounted for each id (card OR hero). */
const mounted = new Map<string, HTMLElement>();
/** Forward source: the clicked card's rect, consumed by the detail hero on mount. */
let pendingSource: { id: string; rect: Rect } | null = null;
/** Reverse target: the last rect (+ image) each id was navigated INTO from. */
const lastSource = new Map<string, { rect: Rect; src: string }>();

// The reverse overlay must fire ONLY on a genuine browser back/forward (POP) —
// NOT when navigating FORWARD out of a detail page (a nav-bar tab, a glaze page's
// "Explore Combinations" link, a constituent-glaze link), which would fling a
// stray clone toward the card's old slot. popstate records the time of the last
// POP; a hero spawns the overlay only if it unmounts right after one.
let lastPopAt = -Infinity;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    lastPopAt = performance.now();
  });
}
const wasRecentPop = () => performance.now() - lastPopAt < 700;

/**
 * Capture the currently-visible photo's rect as BOTH the forward morph source
 * (consumed by the detail hero on mount) and the reverse morph target (where the
 * overlay lands on back). Call this in the card link's onClick, right before
 * navigating.
 */
export function captureImageMorph(id: string) {
  const el = mounted.get(id);
  if (!el) return;
  const rect = measure(el);
  pendingSource = { id, rect };
  lastSource.set(id, { rect, src: imgSrcOf(el) });
}

// Cubic-bezier(0.32, 0.72, 0, 1) as a JS easing function. The reverse overlay is
// driven by requestAnimationFrame (not a fixed WAAPI keyframe set) so it can
// RE-TARGET its destination every frame: the virtualized card's scroll is restored
// async and its slot shifts a few px as images above it load, so a fixed-endpoint
// animation would either freeze at the hero waiting for it to settle (an odd
// in-between state, worse in the grouped glaze list) or land off and snap.
function flipEasing(x: number): number {
  const x1 = 0.32, y1 = 0.72, x2 = 0, y2 = 1;
  const ax = 1 - 3 * x2 + 3 * x1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    t -= (sampleX(t) - x) / d;
  }
  return sampleY(Math.max(0, Math.min(1, t)));
}

/**
 * REVERSE overlay: a fixed-position clone that morphs from the (unmounting) hero
 * back to the card's slot. Immune to the destination list's virtualization and
 * async scroll restore because it is a plain document.body child, not a list item.
 * It re-measures the live card EVERY frame and animates its geometry directly
 * (top/left/width/height, with a constant border-radius), so it starts moving
 * instantly (no hold/freeze), tracks the card's real position, and lands exactly
 * on it with no end snap — and the radius never scales, so corners always match.
 */
function playReverseOverlay(id: string, from: Rect, fallbackTo: Rect, src: string) {
  if (!src || from.width < 1) return;
  const clone = document.createElement('img');
  clone.src = src;
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed',
    top: `${from.top}px`,
    left: `${from.left}px`,
    margin: '0',
    width: `${from.width}px`,
    height: `${from.height}px`,
    objectFit: 'cover',
    // Matches the card image's visible corner (rounded-xl 12px minus the 2px border).
    borderRadius: '10px',
    // Below the fixed Navigation bar (z-50) but above page content.
    zIndex: '40',
    pointerEvents: 'none',
    willChange: 'top, left, width, height',
  } as Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  document.body.appendChild(clone);

  // The live destination rect: the real card once it (re)mounts in the restored,
  // settled list; otherwise the rect it was clicked from.
  const liveTarget = (): Rect => {
    const el = mounted.get(id);
    if (el && el.isConnected) {
      const r = measure(el);
      if (r.width > 1) return r;
    }
    return fallbackTo;
  };

  const t0 = performance.now();
  const frame = () => {
    const p = Math.min(1, (performance.now() - t0) / FLIP_MS);
    const e = flipEasing(p);
    const to = liveTarget();
    clone.style.top = `${from.top + (to.top - from.top) * e}px`;
    clone.style.left = `${from.left + (to.left - from.left) * e}px`;
    clone.style.width = `${from.width + (to.width - from.width) * e}px`;
    clone.style.height = `${from.height + (to.height - from.height) * e}px`;
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      clone.remove();
    }
  };
  requestAnimationFrame(frame);
}

/**
 * Attach the returned ref to the photo box on BOTH the card and the detail hero
 * (same `id`).
 *
 * `ready` gates the effect until the element actually renders (the detail hero
 * only exists once the query resolves); the effect re-runs when `ready` flips so
 * the forward morph plays the moment the hero appears, not during the spinner.
 *
 * `isHero` must be TRUE only for a detail-page HERO. It is (a) the element that
 * self-morphs on forward nav, and (b) the ONLY element that spawns the reverse
 * overlay on back — list cards and the related/child cards a detail page also
 * renders (e.g. a glaze page's "In Combinations" grid) must NOT, or the wrong
 * card would morph from an odd on-page location.
 */
export function useImageMorph(
  id: string,
  ready: boolean = true,
  isHero: boolean = false,
) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return; // not on screen yet (still loading) — re-runs when `ready` flips
    mounted.set(id, el);
    // A hero that just mounted consumes any pending POP (e.g. arriving here via the
    // browser forward button), so a later FORWARD nav out of it can't fire the
    // reverse overlay. A real back-nav sets lastPopAt again after this.
    if (isHero) lastPopAt = -Infinity;

    // FORWARD: the detail hero morphs out of the clicked card's rect. The hero is
    // a stable element (unlike a virtualized card), so a direct self-FLIP is safe.
    if (pendingSource && pendingSource.id === id) {
      const from = pendingSource.rect;
      pendingSource = null; // consume once
      if (!prefersReducedMotion()) {
        const to = measure(el);
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        const sx = to.width ? from.width / to.width : 1;
        const sy = to.height ? from.height / to.height : 1;
        const moved =
          Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 ||
          Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002;
        if (moved) {
          el.animate(
            [
              { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
              { transformOrigin: 'top left', transform: 'translate(0px, 0px) scale(1, 1)' },
            ],
            { duration: FLIP_MS, easing: FLIP_EASE },
          );
        }
      }
    }

    return () => {
      if (mounted.get(id) === el) mounted.delete(id);
      // REVERSE: only a detail HERO, on a genuine back/forward BROWSER nav (POP,
      // no explicit forward capture pending), morphs back to its card via the
      // overlay. `wasRecentPop()` excludes forward PUSH navs out of the detail;
      // `isConnected` avoids a detached (0,0) rect.
      if (
        isHero &&
        pendingSource === null &&
        el.isConnected &&
        wasRecentPop()
      ) {
        const last = lastSource.get(id);
        if (last && !prefersReducedMotion()) {
          playReverseOverlay(id, measure(el), last.rect, last.src || imgSrcOf(el));
        }
      }
    };
  }, [id, ready, isHero]);

  return ref;
}
