/**
 * ScrollManager - Centralized Scroll Restoration
 *
 * This is the SINGLE source of truth for scroll position management.
 *
 * Key principles:
 * 1. Uses history.state to store scroll position (tied to each history entry)
 * 2. Listens to popstate for back/forward navigation detection (ONLY reliable method)
 * 3. Uses document height monitoring to know when content is ready
 * 4. Scrolls to top on forward navigation (link clicks)
 *
 * Place this component once at the app root, after BrowserRouter.
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Minimum time between saves to avoid excessive state updates
const SAVE_THROTTLE = 100;

// Maximum time to wait for content to render (safety limit)
const MAX_RESTORE_WAIT = 2000;

// How often to check if we can scroll (ms)
const CHECK_INTERVAL = 16; // ~60fps

function getScrollFromState(): number {
  try {
    const state = window.history.state as { scrollY?: number } | null;
    return state?.scrollY ?? 0;
  } catch {
    return 0;
  }
}

function saveScrollToState(scrollY: number): void {
  try {
    const currentState = window.history.state ?? {};
    window.history.replaceState(
      { ...currentState, scrollY: Math.round(scrollY) },
      "",
    );
  } catch {
    // Ignore errors
  }
}

export function ScrollManager() {
  const location = useLocation();

  // Track state across renders
  const stateRef = useRef({
    isRestoring: false,
    lastSaveTime: 0,
    currentPath: "",
    isPopNavigation: false,
    savedScrollY: 0,
    navigationPending: false, // Prevents scroll saves after click
  });

  // Handle popstate (back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      stateRef.current.isPopNavigation = true;
      stateRef.current.savedScrollY = getScrollFromState();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Handle navigation changes
  useEffect(() => {
    const { isPopNavigation, savedScrollY, currentPath } = stateRef.current;

    // Skip if same path (e.g., hash change or query param change)
    if (currentPath === location.pathname) {
      return;
    }

    stateRef.current.currentPath = location.pathname;
    // Reset navigation pending flag now that we've navigated
    stateRef.current.navigationPending = false;

    // BACK/FORWARD NAVIGATION: Restore scroll position
    if (isPopNavigation && savedScrollY > 0) {
      stateRef.current.isRestoring = true;
      stateRef.current.isPopNavigation = false;

      // Use polling to wait for document to be tall enough to scroll
      const startTime = Date.now();
      let checkId: number;
      let retryCount = 0;
      const MAX_RETRIES = 10;

      const attemptScroll = () => {
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        const canScroll = maxScroll >= savedScrollY;
        const timedOut = Date.now() - startTime > MAX_RESTORE_WAIT;

        if (canScroll || timedOut) {
          // Document is tall enough (or we timed out), restore scroll
          window.scrollTo(0, savedScrollY);

          // Keep retrying until we're close enough or give up
          const verifyAndRetry = () => {
            const diff = Math.abs(window.scrollY - savedScrollY);
            retryCount++;

            if (diff > 5 && retryCount < MAX_RETRIES) {
              // Still not close enough, try again after layout settles
              window.scrollTo(0, savedScrollY);
              requestAnimationFrame(verifyAndRetry);
            } else {
              stateRef.current.isRestoring = false;
            }
          };

          requestAnimationFrame(verifyAndRetry);
        } else {
          // Not ready yet, check again
          checkId = window.setTimeout(attemptScroll, CHECK_INTERVAL);
        }
      };

      // Start checking immediately
      attemptScroll();

      return () => {
        if (checkId) clearTimeout(checkId);
      };
    }

    // FORWARD NAVIGATION: Scroll to top
    stateRef.current.isPopNavigation = false;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Save scroll position immediately before any navigation
  // This captures the exact scroll position when user clicks a link
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      // Only handle internal navigation links
      if (link && link.href && link.href.startsWith(window.location.origin)) {
        // Mark that navigation is pending to prevent scroll handler from overwriting
        stateRef.current.navigationPending = true;
        // Save scroll position right before navigation
        saveScrollToState(window.scrollY);
      }
    };

    // Use capture phase to run before React Router handles the click
    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  // Save scroll position on scroll (throttled)
  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      // Don't save while restoring or if navigation is pending
      if (stateRef.current.isRestoring || stateRef.current.navigationPending)
        return;

      // Throttle saves
      const now = Date.now();
      if (now - stateRef.current.lastSaveTime < SAVE_THROTTLE) return;

      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        // Double-check navigationPending in case it was set after scheduling
        if (stateRef.current.navigationPending) return;
        stateRef.current.lastSaveTime = Date.now();
        saveScrollToState(window.scrollY);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // This component renders nothing - it's purely side-effects
  return null;
}
