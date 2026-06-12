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

import { useState } from "react";
import { Link } from "react-router-dom";
import { useGlazes } from "../../hooks/useGlazeData";
import { updatePiece } from "../../api/piecesApi";
import { GlazeCombobox } from "../GlazeCombobox";
import { Select } from "../Select";
import { Checkbox } from "../Checkbox";
import { makeCombinationId } from "../../lib/combinationId";
import type { PieceGlaze, PotteryPiece } from "../../types/models";
import { ChevronRight, Close, Upload } from "../Icons";

interface GlazesSectionProps {
  piece: PotteryPiece;
  onUpdated: (updated: PotteryPiece) => void;
}

const inputCls =
  "px-3 py-2 text-sm rounded-lg border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-700 text-clay-800 dark:text-clay-200 placeholder-clay-400 dark:placeholder-clay-500 focus:outline-none focus:ring-2 focus:ring-sage-500/40 focus:border-sage-400";

export function GlazesSection({ piece, onUpdated }: GlazesSectionProps) {
  const { data: allGlazes } = useGlazes();
  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [baseGlazeId, setBaseGlazeId] = useState("");
  const [coats, setCoats] = useState("2");
  const [hasOverGlaze, setHasOverGlaze] = useState(false);
  const [overGlazeId, setOverGlazeId] = useState("");
  const [overCoats, setOverCoats] = useState("2");
  const [isSaving, setIsSaving] = useState(false);

  const sortedGlazes = [...(allGlazes || [])].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  const resetForm = () => {
    setIsAdding(false);
    setLabel("");
    setBaseGlazeId("");
    setCoats("2");
    setHasOverGlaze(false);
    setOverGlazeId("");
    setOverCoats("2");
  };

  const handleAdd = async () => {
    if (!baseGlazeId) return;
    setIsSaving(true);
    const newEntry: PieceGlaze = {
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
      const updated = await updatePiece(piece.id, {
        glazes: [...piece.glazes, newEntry],
      });
      onUpdated(updated);
      resetForm();
    } catch (err) {
      console.error("Failed to add glaze:", err);
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

  return (
    <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200">
          Glaze Plan
        </h2>
        {!isAdding && (
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
            return (
              <li key={i} className="py-2.5">
                {/* Label row: zone label + action buttons on the same line */}
                <div className="flex items-center justify-between mb-0.5">
                  {g.label ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-clay-500 dark:text-earth-400">
                      {g.label}
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-0.5">
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
                      onClick={() => handleRemove(i)}
                      className="p-1.5 text-clay-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Close />
                    </button>
                  </div>
                </div>
                {/* Glaze names get full row width */}
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
              </li>
            );
          })}
        </ul>
      )}

      {/* Add form */}
      {isAdding && (
        <div className="space-y-3 pt-3 border-t border-clay-200 dark:border-earth-600">
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
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!baseGlazeId || isSaving}
              className="flex-1 py-2 rounded-lg bg-sage-600 hover:bg-sage-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? "Adding..." : "Add to plan"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 text-sm hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
