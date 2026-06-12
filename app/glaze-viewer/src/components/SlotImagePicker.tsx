/**
 * Drag-to-reorder image slot picker used by the upload form.
 *
 * Owns no business logic — the parent keeps the `slots` state and decides
 * how to turn it into a `slotOrder` payload (see `uploadsApi.ts`). This
 * component only handles:
 *   - rendering each slot's thumbnail + remove button + "Cover" badge on slot 0
 *   - pointer-event based drag-and-drop to reorder (works on mouse + touch;
 *     touch uses a 350ms long-press to enter drag mode so a normal tap or
 *     scroll attempt is unaffected)
 *   - the "Add more" tile that opens a file picker
 *   - an optional secondary grid of fired-stage piece photos that the user
 *     can toggle into the main slot list
 *
 * Keeping it dumb means UploadCombinationPage stays in control of edit mode,
 * URL params, validation, and submission — the picker just edits a list.
 */

import { useEffect, useRef, useState } from "react";
import { prefixCdnUrl } from "../utils/glazeUtils";
import { randomId } from "../utils/randomId";
import { Check, Close, Plus } from "./Icons";

// Long-press duration before a touch begins a reorder (matches iOS).
const TOUCH_LONG_PRESS_MS = 350;
// Movement that cancels a pending long-press — user was trying to scroll.
const LONG_PRESS_CANCEL_PX = 8;

export type PhotoSlot = {
  id: string;
  previewUrl: string;
  file?: File;
  existingUrl?: string;
};

interface SlotImagePickerProps {
  slots: PhotoSlot[];
  onSlotsChange: (next: PhotoSlot[] | ((prev: PhotoSlot[]) => PhotoSlot[])) => void;
  /** Hard cap on slot count. Defaults to 10. */
  maxSlots?: number;
  /** Pushed up to the parent so it can show an Alert. */
  onError?: (message: string) => void;
  /** Optional set of piece photos the user can pull into a slot. */
  pieceFiredPhotos?: string[];
}

export function SlotImagePicker({
  slots,
  onSlotsChange,
  maxSlots = 10,
  onError,
  pieceFiredPhotos = [],
}: SlotImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // DOM refs for elementFromPoint hit-testing during a drag.
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Mirror of `dragOverIndex` for the document pointerup closure.
  const dragOverIndexRef = useRef<number | null>(null);
  useEffect(() => {
    dragOverIndexRef.current = dragOverIndex;
  }, [dragOverIndex]);

  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const addFiles = (files: File[]) => {
    files.forEach((file) => {
      const id = randomId();
      onSlotsChange((prev) => [...prev, { id, previewUrl: "", file }]);
      const reader = new FileReader();
      reader.onloadend = () =>
        onSlotsChange((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, previewUrl: reader.result as string } : s,
          ),
        );
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        onError?.("Please select only image files");
        return;
      }
    }
    if (slots.length + files.length > maxSlots) {
      onError?.(`Maximum ${maxSlots} images per entry`);
      return;
    }
    addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSlot = (id: string) =>
    onSlotsChange((prev) => prev.filter((s) => s.id !== id));

  const moveSlot = (from: number, to: number) =>
    onSlotsChange((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const togglePiecePhoto = (url: string) =>
    onSlotsChange((prev) => {
      const exists = prev.some((s) => s.existingUrl === url);
      if (exists) return prev.filter((s) => s.existingUrl !== url);
      if (prev.length >= maxSlots) return prev;
      return [
        ...prev,
        { id: randomId(), previewUrl: url, existingUrl: url },
      ];
    });

  // Enter drag mode — fires after long-press for touch, immediately for mouse.
  const startDrag = (index: number) => {
    setDragFromIndex(index);
    setDragOverIndex(null);
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      try {
        navigator.vibrate(20);
      } catch {
        // best-effort haptic
      }
    }
  };

  // Document-level listeners during drag so the pointer can leave the slot.
  useEffect(() => {
    if (dragFromIndex === null) return;

    const findSlotIndexAt = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const idx = slotRefs.current.findIndex(
        (s) => s !== null && (s === el || s.contains(el)),
      );
      return idx >= 0 ? idx : null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const next = findSlotIndexAt(e.clientX, e.clientY);
      setDragOverIndex(next);
    };

    const onPointerEnd = () => {
      const from = dragFromIndex;
      const to = dragOverIndexRef.current;
      if (from !== null && to !== null && from !== to) {
        moveSlot(from, to);
      }
      setDragFromIndex(null);
      setDragOverIndex(null);
      pointerStartRef.current = null;
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerEnd);
    document.addEventListener("pointercancel", onPointerEnd);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragFromIndex]);

  useEffect(() => () => clearLongPress(), []);

  const handleSlotPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Let the Close button (or any interactive child) handle its own press.
    const target = e.target as HTMLElement;
    if (target.closest("[data-slot-action]")) return;

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };

    if (e.pointerType === "touch") {
      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        startDrag(index);
      }, TOUCH_LONG_PRESS_MS);
    } else {
      // preventDefault avoids text selection while dragging.
      e.preventDefault();
      startDrag(index);
    }
  };

  // Cancel a pending long-press if the touch moves too far (user is scrolling).
  const handleSlotPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current === null) return;
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > LONG_PRESS_CANCEL_PX || dy > LONG_PRESS_CANCEL_PX) {
      clearLongPress();
      pointerStartRef.current = null;
    }
  };

  const handleSlotPointerEnd = () => {
    clearLongPress();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Photo grid — slots reorderable on mouse and touch. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        {slots.map((slot, index) => (
          <div
            key={slot.id}
            ref={(el) => {
              slotRefs.current[index] = el;
            }}
            // touch-action: none so a long-press drag isn't hijacked by browser scroll.
            style={slots.length > 1 ? { touchAction: "none" } : undefined}
            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors select-none ${
              slots.length > 1 ? "cursor-grab active:cursor-grabbing" : ""
            } ${
              dragFromIndex === index
                ? "opacity-50 border-terracotta-400"
                : dragOverIndex === index
                  ? "border-terracotta-400 border-dashed"
                  : "border-clay-200 dark:border-earth-600"
            }`}
            onPointerDown={(e) => handleSlotPointerDown(e, index)}
            onPointerMove={handleSlotPointerMove}
            onPointerUp={handleSlotPointerEnd}
            onPointerCancel={handleSlotPointerEnd}
          >
            <img
              src={slot.file ? slot.previewUrl : prefixCdnUrl(slot.previewUrl)}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover pointer-events-none"
            />
            {index === 0 && (
              <span className="absolute top-1 left-1 px-1.5 py-0.5 text-xs font-medium rounded bg-moss-500 text-white">
                Cover
              </span>
            )}
            <button
              type="button"
              data-slot-action
              onClick={() => removeSlot(slot.id)}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-red-600 transition-colors"
            >
              <Close />
            </button>
          </div>
        ))}

        {/* Add-more tile */}
        {slots.length < maxSlots && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-clay-300 dark:border-earth-600 bg-clay-50 dark:bg-earth-800 flex flex-col items-center justify-center gap-1 hover:border-clay-400 dark:hover:border-earth-500 transition-colors"
          >
            <Plus size="2xl" tone="muted" strokeWidth={1.5} />
            <span className="text-xs text-clay-400 dark:text-clay-500">
              {slots.length === 0 ? "Add photos" : "Add more"}
            </span>
          </button>
        )}
      </div>

      {/* Pick from fired piece photos */}
      {pieceFiredPhotos.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-clay-600 dark:text-clay-400 mb-2">
            Or add photos from your fired piece
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {pieceFiredPhotos.map((url) => {
              const isInSlots = slots.some((s) => s.existingUrl === url);
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => togglePiecePhoto(url)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    isInSlots
                      ? "border-terracotta-500 ring-2 ring-terracotta-400/50"
                      : "border-clay-200 dark:border-earth-600"
                  }`}
                >
                  <img
                    src={prefixCdnUrl(url)}
                    alt="Fired piece photo"
                    className="w-full h-full object-cover"
                  />
                  {isInSlots && (
                    <div className="absolute inset-0 bg-terracotta-500/20 flex items-center justify-center">
                      <Check
                        className="w-6 h-6 text-white drop-shadow"
                        strokeWidth={2.5}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
