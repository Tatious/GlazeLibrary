/**
 * useHistorySearch - Search state that only restores on backward navigation
 *
 * Uses browser history.state to store search value, so it:
 * - Starts empty on forward navigation (clicking links)
 * - Restores previous value on backward navigation (browser back button)
 *
 * This mirrors how ScrollManager handles scroll position restoration.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";

interface HistorySearchState {
  search?: string;
}

function getSearchFromState(): string {
  try {
    const state = window.history.state as HistorySearchState | null;
    return state?.search ?? "";
  } catch {
    return "";
  }
}

function saveSearchToState(search: string): void {
  try {
    const currentState = window.history.state ?? {};
    window.history.replaceState({ ...currentState, search }, "");
  } catch {
    // Ignore errors
  }
}

// Global ref to track current search value across all instances
// This allows us to save the correct value on link clicks
const globalSearchRef = { current: "" };

export function useHistorySearch(): [string, (value: string) => void] {
  const location = useLocation();

  // Track navigation state
  const stateRef = useRef({
    isPopNavigation: false,
    currentPath: location.pathname,
    initialized: false,
  });

  // Handle popstate (back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      stateRef.current.isPopNavigation = true;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Save search to history state before link clicks (forward navigation)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      // Only handle internal navigation links
      if (link && link.href && link.href.startsWith(window.location.origin)) {
        // Save current search to history state before navigating away
        saveSearchToState(globalSearchRef.current);
      }
    };

    // Use capture phase to run before React Router handles the click
    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  // Initialize search state
  const [search, setSearchState] = useState(() => {
    // On initial load, check if there's a search in history state (e.g., page refresh)
    const initial = getSearchFromState();
    globalSearchRef.current = initial;
    return initial;
  });

  // Handle navigation changes
  useEffect(() => {
    const { isPopNavigation, currentPath, initialized } = stateRef.current;

    // Skip the first render (initialization)
    if (!initialized) {
      stateRef.current.initialized = true;
      stateRef.current.currentPath = location.pathname;
      return;
    }

    // Skip if same path
    if (currentPath === location.pathname) {
      return;
    }

    stateRef.current.currentPath = location.pathname;

    // BACK/FORWARD NAVIGATION: Restore search from the history state we navigated TO
    if (isPopNavigation) {
      stateRef.current.isPopNavigation = false;
      const restoredSearch = getSearchFromState();
      setSearchState(restoredSearch);
      globalSearchRef.current = restoredSearch;
      return;
    }

    // FORWARD NAVIGATION: Clear search
    setSearchState("");
    globalSearchRef.current = "";
  }, [location.pathname]);

  // Custom setter that also saves to history state
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    globalSearchRef.current = value;
    // Save immediately so it's captured if user navigates via other means
    saveSearchToState(value);
  }, []);

  return [search, setSearch];
}
