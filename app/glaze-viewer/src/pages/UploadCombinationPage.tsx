/**
 * Upload Combination Page
 * Let users upload their own glaze combination photos
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useGlazes } from "../hooks/useGlazeData";
import { createUpload, fetchUpload, updateUpload, type SlotOrderItem } from "../api/uploadsApi";
import { getPiece } from "../api/piecesApi";
import { PageLayout } from "../components/PageLayout";
import { Alert } from "../components/Alert";
import { SlotImagePicker, type PhotoSlot } from "../components/SlotImagePicker";
import { Input, Textarea } from "../components/Input";
import { Select } from "../components/Select";
import { GlazeCombobox } from "../components/GlazeCombobox";
import { Close } from "../components/Icons";
import { randomId } from "../utils/randomId";

// Common tags for glaze combinations
const COMMON_TAGS = [
  // Colors
  "blue",
  "green",
  "brown",
  "red",
  "orange",
  "yellow",
  "purple",
  "pink",
  "white",
  "black",
  "gray",
  "teal",
  "turquoise",
  // Finishes
  "matte",
  "satin",
  "glossy",
  "semi-matte",
  // Effects
  "runny",
  "breaking",
  "crystalline",
  "metallic",
  "iridescent",
  "speckled",
  "textured",
  "smooth",
  "variegated",
  // Style
  "earthy",
  "vibrant",
  "subtle",
  "dramatic",
  "natural",
  "modern",
] as const;

export function UploadCombinationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: glazes } = useGlazes();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Get pre-filled values from URL params
  const prefilledTop = searchParams.get("top") || "";
  const prefilledBottom = searchParams.get("bottom") || "";
  const prefilledSingle = searchParams.get("single") === "1";
  const prefilledPiece = searchParams.get("piece") || "";

  // Edit mode params
  const editEntryId = searchParams.get("edit");
  const editComboId = searchParams.get("combo");
  const isEditMode = !!editEntryId;

  const [topGlazeId, setTopGlazeId] = useState(prefilledTop);
  const [bottomGlazeId, setBottomGlazeId] = useState(prefilledBottom);
  const [isSingleGlaze, setIsSingleGlaze] = useState(prefilledSingle);
  const [topCoats, setTopCoats] = useState("2");
  const [bottomCoats, setBottomCoats] = useState("2");
  const [cone, setCone] = useState("");
  const [clayBody, setClayBody] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [slots, setSlots] = useState<PhotoSlot[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingEntry, setIsLoadingEntry] = useState(isEditMode);
  const [pieceFiredPhotos, setPieceFiredPhotos] = useState<string[]>([]);

  // Load existing entry data in edit mode
  useEffect(() => {
    async function loadEntryData() {
      if (!editEntryId) return;
      try {
        setIsLoadingEntry(true);
        const entry = await fetchUpload(editEntryId);
        if (entry) {
          setTopGlazeId(entry.topGlazeId || "");
          setBottomGlazeId(entry.bottomGlazeId || "");
          // Single-glaze entries have no bottom glaze — derive the
          // form's mode from the entry rather than relying on the URL
          // `?single=1` hint.
          setIsSingleGlaze(!entry.bottomGlazeId);
          setTopCoats(String(entry.topCoats || 2));
          setBottomCoats(String(entry.bottomCoats || 2));
          setCone(entry.cone || "");
          setClayBody(entry.clayBody || "");
          setNotes(entry.notes || "");
          setTags(entry.tags || []);
          const urls = entry.imageUrls || (entry.imageUrl ? [entry.imageUrl] : []);
          setSlots(
            urls.map((url: string) => ({
              id: randomId(),
              previewUrl: url,
              existingUrl: url,
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load entry data:", err);
        setError("Failed to load entry data");
      } finally {
        setIsLoadingEntry(false);
      }
    }
    loadEntryData();
  }, [editEntryId]);

  // Load fired-stage photos from the linked piece so the user can reuse them
  useEffect(() => {
    async function loadPieceFiredPhotos() {
      if (!prefilledPiece) return;
      try {
        const piece = await getPiece(prefilledPiece);
        const firedRecord = piece.stageRecords?.find(
          (r) => r.stage === "fired",
        );
        if (firedRecord?.photos?.length) {
          setPieceFiredPhotos(firedRecord.photos);
        }
      } catch {
        // Optional — silently ignore
      }
    }
    loadPieceFiredPhotos();
  }, [prefilledPiece]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { state: { from: "/upload" } });
    }
  }, [authLoading, user, navigate]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Require at least one image slot
    if (!user || slots.length === 0) {
      setError("At least one image is required");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const fileSlots = slots.filter((s) => s.file);
      const slotOrder: SlotOrderItem[] = slots.map((s) =>
        s.file
          ? { t: "f", i: fileSlots.findIndex((fs) => fs.id === s.id) }
          : { t: "e", u: s.existingUrl! },
      );

      const input = {
        topGlazeId,
        bottomGlazeId: isSingleGlaze ? null : bottomGlazeId || null,
        topCoats: parseInt(topCoats),
        bottomCoats: parseInt(bottomCoats),
        cone: cone.trim(),
        clayBody: clayBody.trim(),
        notes: notes.trim(),
        tags,
        files: fileSlots.map((s) => s.file!),
        slotOrder,
        pieceId: prefilledPiece || undefined,
      };

      const { combinationId, entryId } = isEditMode
        ? await updateUpload(editEntryId!, input)
        : await createUpload(input);

      // Force refetch every cache that surfaces uploads so the change appears
      // immediately on the profile / glaze / combo / piece pages.
      await queryClient.refetchQueries({ queryKey: ["combinations"] });
      await queryClient.refetchQueries({ queryKey: ["userGlazeResults"] });
      await queryClient.refetchQueries({ queryKey: ["uploads"] });
      await queryClient.refetchQueries({ queryKey: ["pieces"] });

      // Land on the result's detail page (glaze or combination) with the
      // new entry selected so the user immediately sees what they shared.
      const entryQs = entryId ? `?entry=${entryId}` : "";
      if (isSingleGlaze && topGlazeId) {
        navigate(`/glaze/${topGlazeId}${entryQs}`);
        return;
      }
      const navComboId = combinationId || editComboId;
      navigate(`/combination/${navComboId}${entryQs}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditMode ? "update" : "upload"}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Sort glazes alphabetically for the dropdowns
  const sortedGlazes = [...(glazes || [])].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  if (authLoading || isLoadingEntry) {
    return (
      <PageLayout maxWidth="lg" padY="8">
        <div className="text-center text-clay-600 dark:text-clay-400">
          Loading...
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PageLayout maxWidth="lg" padY="8">
      <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-6">
        {isEditMode ? "Edit Result" : "Share Results"}
      </h1>

      {error && (
        <Alert className="mb-4">{error}</Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload - Multiple Images */}
        <div>
          <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-2">
            Photos {!isEditMode && "*"}
            <span className="text-clay-400 dark:text-clay-500 font-normal ml-1">
              (up to 10 photos)
            </span>
          </label>
          <SlotImagePicker
            slots={slots}
            onSlotsChange={setSlots}
            pieceFiredPhotos={pieceFiredPhotos}
            onError={(message) => setError(message)}
          />
        </div>

        {/* Single/Layered toggle */}
        {!isEditMode && (
          <div className="flex rounded-lg border border-clay-300 dark:border-earth-600 overflow-hidden">
            <button
              type="button"
              onClick={() => { setIsSingleGlaze(false); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                !isSingleGlaze
                  ? "bg-terracotta-500 text-white"
                  : "bg-white dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-600"
              }`}
            >
              Layered combo
            </button>
            <button
              type="button"
              onClick={() => { setIsSingleGlaze(true); setBottomGlazeId(""); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                isSingleGlaze
                  ? "bg-terracotta-500 text-white"
                  : "bg-white dark:bg-earth-700 text-clay-600 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-600"
              }`}
            >
              Single glaze
            </button>
          </div>
        )}

        {/* Top Glaze */}
        <GlazeCombobox
          id="topGlaze"
          label={isSingleGlaze ? "Glaze" : "Top Glaze"}
          fullWidth
          clearable
          glazes={sortedGlazes}
          value={topGlazeId || null}
          onChange={(next) => setTopGlazeId(typeof next === "string" ? next : "")}
          placeholder={isSingleGlaze ? "Select glaze (optional)" : "Select top glaze (optional)"}
        />

        {/* Bottom Glaze */}
        {!isSingleGlaze && (
          <GlazeCombobox
            id="bottomGlaze"
            label="Bottom Glaze"
            fullWidth
            clearable
            glazes={sortedGlazes}
            value={bottomGlazeId || null}
            onChange={(next) =>
              setBottomGlazeId(typeof next === "string" ? next : "")
            }
            placeholder="Select bottom glaze (optional)"
          />
        )}

        {/* Coat counts. Side-by-side in layered mode; single-glaze mode
            collapses to one full-width "Coats" field (no "Top" prefix —
            there's no bottom glaze to contrast it against). */}
        {isSingleGlaze ? (
          <div>
            <label
              htmlFor="topCoats"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Coats
            </label>
            <Select
              id="topCoats"
              fullWidth
              value={topCoats}
              onChange={(e) => setTopCoats(e.target.value)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="topCoats"
                className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
              >
                Top Glaze Coats
              </label>
              <Select
                id="topCoats"
                fullWidth
                value={topCoats}
                onChange={(e) => setTopCoats(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="bottomCoats"
                className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
              >
                Bottom Glaze Coats
              </label>
              <Select
                id="bottomCoats"
                fullWidth
                value={bottomCoats}
                onChange={(e) => setBottomCoats(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Cone and Clay Body - side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="cone"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Cone
            </label>
            <Input
              id="cone"
              value={cone}
              onChange={(e) => setCone(e.target.value)}
              placeholder="e.g. 6, 06, 10"
            />
          </div>
          <div>
            <label
              htmlFor="clayBody"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Clay Body
            </label>
            <Input
              id="clayBody"
              value={clayBody}
              onChange={(e) => setClayBody(e.target.value)}
              placeholder="e.g. Stoneware, Porcelain"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-2">
            Tags
          </label>

          {/* Selected tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-moss-500 text-white text-sm hover:bg-moss-600 transition-colors"
                >
                  {tag}
                  <Close size="sm" />
                </button>
              ))}
            </div>
          )}

          {/* Available tags */}
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {COMMON_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTags([...tags, tag])}
                className="px-2.5 py-1 rounded-full border border-clay-300 dark:border-earth-600 text-clay-600 dark:text-clay-400 text-sm hover:border-moss-400 hover:text-moss-600 dark:hover:border-moss-500 dark:hover:text-moss-400 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
          >
            Notes
          </label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Technique, application method, other observations..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isUploading || slots.length === 0}
          className="w-full py-3 px-4 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading
            ? isEditMode
              ? "Saving..."
              : "Uploading..."
            : isEditMode
              ? "Save Changes"
              : "Share"}
        </button>
      </form>
    </PageLayout>
  );
}
