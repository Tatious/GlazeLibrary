/**
 * `useIsMobile` — small viewport-class hook used by responsive surfaces
 * (Combobox, TagsDialog, PickerSurface, AddToContainerModal).
 *
 * Returns `true` when the viewport is narrow (<640px) OR short (<500px tall,
 * so landscape phones still get the bottom-sheet treatment instead of an
 * anchored popover that won't fit). Updates on `resize`.
 *
 * SSR-safe — defaults to `false` until the first effect run.
 */

import { useEffect, useState } from "react";

const MOBILE_MAX_WIDTH = 640;
const MOBILE_MAX_HEIGHT = 500;

function compute(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.innerWidth < MOBILE_MAX_WIDTH ||
    window.innerHeight < MOBILE_MAX_HEIGHT
  );
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(compute);

  useEffect(() => {
    const onResize = () => setIsMobile(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}
