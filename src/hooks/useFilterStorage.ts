/**
 * Tiny "useState that mirrors itself to localStorage" hook.
 *
 * Replaces the ad-hoc
 *   const [x, setX] = useState(() => loadFromStorage(KEY, default));
 *   useEffect(() => localStorage.setItem(KEY, JSON.stringify(x)), [x]);
 * pattern that was repeated 5+ times across GlazesPage / HomePage.
 *
 * - Reads JSON-parsed value on first render (lazy initializer), falling back
 *   to `defaultValue` on any error.
 * - Writes JSON-stringified value on every change, swallowing storage errors
 *   (private browsing / quota).
 * - Accepts setter style identical to `useState` — value or updater fn.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useFilterStorage<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? defaultValue : (JSON.parse(raw) as T);
    } catch {
      return defaultValue;
    }
  });

  // Stable key reference for the persist effect (avoids re-running just
  // because a parent re-rendered with the same string).
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // Ignore storage errors (private mode / quota).
    }
  }, [value]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(next);
  }, []);

  return [value, set];
}
