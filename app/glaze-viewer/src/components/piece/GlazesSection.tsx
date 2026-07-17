/**
 * "Glaze Plan" panel on PieceDetailPage.
 *
 * A piece's glaze plan is a list of `PieceGlaze` rows (base glaze + optional
 * "over" glaze + per-row coats and zone label). This panel renders the list,
 * provides an inline add-form, and lets the user remove rows or jump to the
 * upload page pre-filled to publish that combination as a community entry.
 *
 * Owns: form state (label, base glaze, over glaze, coats, isAdding, isSaving).
 * Does NOT own piece state — the parent owns the piece and is notified of
 * mutations via `onUpdated`.
 *
 * Extracted from PieceDetailPage in Phase 3 (~190 LOC inline block).
 */

import { useState, type Ref } from "react";
import { Link } from "react-router-dom";
import { useGlazes } from "../../hooks/useGlazeData";
import { updatePiece } from "../../api/piecesApi";
import { GlazeCombobox } from "../GlazeCombobox";
import { Select } from "../Select";
import { Checkbox } from "../Checkbox";
import { makeCombinationId } from "../../lib/combinationId";
import { getPrimaryImage } from "../../utils/glazeUtils";
import type { PieceGlaze, PotteryPiece } from "../../types/models";
import { ChevronRight, Close, GlazeSwatch, Pencil, Swap, Upload } from "../Icons";

interface GlazesSectionProps {
  piece: PotteryPiece;
  onUpdated: (updated: PotteryPiece) => void;
  /** Attached to the panel root so the Glaze Inspo grid (a drag source) can
   *  hit-test whether an item was dropped onto the plan. */
  cardRef?: Ref<HTMLDivElement>;
  /** A drag is in progress somewhere — show a subtle "droppable" outline. */
  dragActive?: boolean;
  /** The dragged item is currently hovering the plan — show a strong highlight. */
  dropActive?: boolean;
}

const inputCls =
  "px-3 py-2 text-sm rounded-lg border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-700 text-clay-800 dark:text-clay-200 placeholder-clay-400 dark:placeholder-clay-500 focus:outline-none focus:ring-2 focus:ring-sage-500/40 focus:border-sage-400";

export function GlazesSection({ piece, onUpdated, cardRef, dragActive, dropActive }: GlazesSectionProps) {
  const { data: allGlazes } = useGlazes();
  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [baseGlazeId, setBaseGlazeId] = useState("");
  const [coats, setCoats] = useState("2");
  const [hasOverGlaze, setHasOverGlaze] = useState(false);
  const [overGlazeId, setOverGlazeId] = useState("");
  const [overCoats, setOverCoats] = useState("2");
  const [isSaving, setIsSaving] = useState(false);
  // When non-null, the form edits this existing row instead of adding a new one.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const sortedGlazes = [...(allGlazes || [])].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  const resetForm = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setLabel("");
    setBaseGlazeId("");
    setCoats("2");
    setHasOverGlaze(false);
    setOverGlazeId("");
    setOverCoats("2");
  };

  // Flip the in-progress base and top layers (and their coats) in the add form.
  const handleSwapLayers = () => {
    setBaseGlazeId(overGlazeId);
    setOverGlazeId(baseGlazeId);
    setCoats(overCoats);
    setOverCoats(coats);
  };

  // Populate the form from an existing row and switch it into edit mode.
  const startEdit = (idx: number) => {
    const row = piece.glazes[idx];
    setEditingIndex(idx);
    setIsAdding(false);
    setLabel(row.label || "");
    setBaseGlazeId(row.glazeId);
    setCoats(String(row.coats || 2));
    setHasOverGlaze(!!row.overGlazeId);
    setOverGlazeId(row.overGlazeId || "");
    setOverCoats(String(row.overCoats || 2));
  };

  // Append a new row, or replace the row being edited when editingIndex is set.
  const handleSubmit = async () => {
    if (!baseGlazeId) return;
    setIsSaving(true);
    const entry: PieceGlaze = {
      ...(label.trim() && { label: label.trim() }),
      glazeId: baseGlazeId,
      coats: parseInt(coats),
      ...(hasOverGlaze &&
        overGlazeId && {
          overGlazeId,
          overCoats: parseInt(overCoats),
        }),
    };
    try {
      const nextGlazes =
        editingIndex !== null
          ? piece.glazes.map((g, i) => (i === editingIndex ? entry : g))
          : [...piece.glazes, entry];
      const updated = await updatePiece(piece.id, { glazes: nextGlazes });
      onUpdated(updated);
      resetForm();
    } catch (err) {
      console.error("Failed to save glaze:", err);
    }
    setIsSaving(false);
  };

  const handleRemove = async (idx: number) => {
    try {
      const updated = await updatePiece(piece.id, {
        glazes: piece.glazes.filter((_, i) => i !== idx),
      });
      onUpdated(updated);
    } catch (err) {
      console.error("Failed to remove glaze:", err);
    }
  };

  // Flip an existing combo row's base and top layers (and their coats), then
  // persist. Single-glaze rows have nothing to swap and are left untouched.
  const handleSwap = async (idx: number) => {
    const row = piece.glazes[idx];
    if (!row.overGlazeId) return;
    const swapped: PieceGlaze = {
      ...row,
      glazeId: row.overGlazeId,
      coats: row.overCoats,
      overGlazeId: row.glazeId,
      overCoats: row.coats,
    };
    try {
      const updated = await updatePiece(piece.id, {
        glazes: piece.glazes.map((g, i) => (i === idx ? swapped : g)),
      });
      onUpdated(updated);
    } catch (err) {
      console.error("Failed to swap glaze layers:", err);
    }
  };

  // The add / edit form. Rendered in-place inside a row when that row is being
  // edited, or at the bottom of the list when adding a new entry.
  const renderForm = () => (
    <div className="space-y-3">
      {/* Zone label */}
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Zone — e.g. inside, rim (optional)"
        className={`w-full ${inputCls}`}
      />

      {/* Base glaze + coats */}
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <GlazeCombobox
            glazes={sortedGlazes}
            value={baseGlazeId || null}
            onChange={(next) =>
              setBaseGlazeId(typeof next === "string" ? next : "")
            }
            fullWidth
            clearable
            ariaLabel="Base glaze"
            placeholder="Select glaze…"
          />
        </div>
        <Select
          value={coats}
          onChange={(e) => setCoats(e.target.value)}
          title="Coats"
          aria-label="Coats"
          className="w-20 text-center"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </Select>
      </div>

      {/* Layer toggle */}
      <Checkbox
        checked={hasOverGlaze}
        onChange={(e) => setHasOverGlaze(e.target.checked)}
        label="Layer a second glaze on top"
      />

      {/* Over glaze + coats */}
      {hasOverGlaze && (
        <>
          {/* Swap base ↔ top */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwapLayers}
              disabled={!baseGlazeId && !overGlazeId}
              title="Swap base and top glaze"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-clay-500 dark:text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Swap className="w-4 h-4" />
              Swap layers
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <GlazeCombobox
                glazes={sortedGlazes}
                value={overGlazeId || null}
                onChange={(next) =>
                  setOverGlazeId(typeof next === "string" ? next : "")
                }
                fullWidth
                clearable
                ariaLabel="Over glaze"
                placeholder="Over glaze…"
              />
            </div>
            <Select
              value={overCoats}
              onChange={(e) => setOverCoats(e.target.value)}
              title="Coats"
              aria-label="Over coats"
              className="w-20 text-center"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </Select>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!baseGlazeId || isSaving}
          className="flex-1 py-2 rounded-lg bg-sage-600 hover:bg-sage-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSaving
            ? editingIndex !== null
              ? "Saving..."
              : "Adding..."
            : editingIndex !== null
              ? "Save changes"
              : "Add to plan"}
        </button>
        <button
          onClick={resetForm}
          className="px-4 py-2 rounded-lg border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 text-sm hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={cardRef}
      className={`bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 transition-colors ${
        dropActive
          ? "border-terracotta-400 dark:border-terracotta-500 ring-2 ring-terracotta-300/70 dark:ring-terracotta-500/40"
          : dragActive
            ? "border-dashed border-terracotta-300 dark:border-terracotta-600"
            : "border-clay-200 dark:border-earth-600"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200">
          Glaze Plan
        </h2>
        {!isAdding && editingIndex === null && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-terracotta-600 dark:text-terracotta-400 hover:underline font-medium"
          >
            + Add
          </button>
        )}
      </div>

      {/* Existing entries */}
      {piece.glazes.length === 0 && !isAdding && (
        <p className="text-sm text-clay-500 dark:text-clay-400">
          No glaze plan yet. Add a glaze or combination to start planning.
        </p>
      )}

      {piece.glazes.length > 0 && (
        <ul className="divide-y divide-clay-100 dark:divide-earth-700 mb-4">
          {piece.glazes.map((g, i) => {
            // The row being edited morphs into the form in-place.
            if (editingIndex === i) {
              return (
                <li key={i} className="py-2.5">
                  {renderForm()}
                </li>
              );
            }
            const base = allGlazes?.find((gl) => gl.id === g.glazeId);
            const over = g.overGlazeId
              ? allGlazes?.find((gl) => gl.id === g.overGlazeId)
              : null;
            const isCombo = !!g.overGlazeId;
            const rowComboId = isCombo
              ? makeCombinationId(g.overGlazeId!, g.glazeId)
              : g.glazeId;
            // Last match wins so the icon always points at the newest result
            // when a plan row has been published more than once.
            const publishedEntry = [...(piece.publishedEntries || [])]
              .reverse()
              .find((p) => p.comboId === rowComboId);
            const publishedHref = publishedEntry
              ? isCombo
                ? `/combination/${publishedEntry.comboId}?entry=${publishedEntry.entryId}`
                : `/glaze/${g.glazeId}?entry=${publishedEntry.entryId}`
              : null;
            const baseThumb = base ? getPrimaryImage(base) : null;
            const overThumb = over ? getPrimaryImage(over) : null;
            return (
              <li key={i} className="py-2.5">
                <div className="flex items-center gap-3">
                  {/* Base glaze thumbnail (combos get a small over-glaze badge) */}
                  <div className="relative w-11 h-11 shrink-0">
                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-clay-200 dark:border-earth-600 bg-clay-100 dark:bg-earth-700">
                      {baseThumb ? (
                        <img
                          src={baseThumb}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-sage-50 dark:bg-sage-900/20">
                          <GlazeSwatch
                            className="w-5 h-5 text-sage-400"
                            strokeWidth={1.5}
                          />
                        </div>
                      )}
                    </div>
                    {isCombo && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-md overflow-hidden border-2 border-white dark:border-earth-800 bg-clay-100 dark:bg-earth-700">
                        {overThumb ? (
                          <img
                            src={overThumb}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-sage-50 dark:bg-sage-900/20">
                            <GlazeSwatch
                              className="w-3 h-3 text-sage-400"
                              strokeWidth={1.5}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Zone label + glaze names */}
                  <div className="flex-1 min-w-0">
                    {g.label && (
                      <span className="block text-xs font-semibold uppercase tracking-wide text-clay-500 dark:text-earth-400 mb-0.5">
                        {g.label}
                      </span>
                    )}
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <Link
                        to={`/glaze/${g.glazeId}`}
                        className="text-sm font-medium text-clay-800 dark:text-clay-200 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
                      >
                        {base?.displayName || g.glazeId}
                      </Link>
                      {g.coats && g.coats > 1 && (
                        <span className="text-xs text-clay-400 dark:text-earth-500">
                          {g.coats}×
                        </span>
                      )}
                      {over && (
                        <>
                          <span className="text-xs text-clay-400 dark:text-earth-500 italic">
                            over
                          </span>
                          <Link
                            to={`/glaze/${g.overGlazeId}`}
                            className="text-sm font-medium text-clay-800 dark:text-clay-200 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
                          >
                            {over.displayName}
                          </Link>
                          {g.overCoats && g.overCoats > 1 && (
                            <span className="text-xs text-clay-400 dark:text-earth-500">
                              {g.overCoats}×
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {publishedHref ? (
                      <Link
                        to={publishedHref}
                        className="p-1.5 text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
                        title="View published result"
                      >
                        <ChevronRight />
                      </Link>
                    ) : (
                      <Link
                        to={(() => {
                          const params = new URLSearchParams();
                          if (g.overGlazeId) {
                            params.set("top", g.overGlazeId);
                            params.set("bottom", g.glazeId);
                          } else {
                            params.set("top", g.glazeId);
                            params.set("single", "1");
                          }
                          params.set("piece", piece.id);
                          return `/upload?${params.toString()}`;
                        })()}
                        className="p-1.5 text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
                        title="Publish result"
                      >
                        <Upload />
                      </Link>
                    )}
                    <button
                      onClick={() => startEdit(i)}
                      className="p-1.5 text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
                      title="Edit"
                      aria-label="Edit glaze"
                    >
                      <Pencil />
                    </button>
                    {isCombo && (
                      <button
                        onClick={() => handleSwap(i)}
                        className="p-1.5 text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
                        title="Swap base and top glaze"
                        aria-label="Swap base and top glaze"
                      >
                        <Swap />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(i)}
                      className="p-1.5 text-clay-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Close />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add form (editing an existing row renders in-place in the list above) */}
      {isAdding && (
        <div className="pt-3 border-t border-clay-200 dark:border-earth-600">
          {renderForm()}
        </div>
      )}
    </div>
  );
}
