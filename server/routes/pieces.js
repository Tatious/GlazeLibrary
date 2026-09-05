/**
 * /api/pieces \u2014 private studio log (SQLite).
 *
 * Photo ownership: piece stage photos live under `uploads/pieces/...`. Piece
 * delete removes the piece's own files; community uploads previously
 * published from this piece keep their own independent copies (the publish
 * flow copies files into the upload's namespace).
 */

import { Router } from "express";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  savePieceImage,
  deleteImage,
  getPhotoOwner,
  useAzureStorage,
} from "../storage.js";
import { upload, processImage } from "../lib/images.js";
import { Pieces, Collections, ResourceMembers } from "../lib/repositories.js";
import { verifyUser, optionalVerifyUser } from "../middleware/auth.js";
import { loadAndAuthorize } from "../middleware/loadAndAuthorize.js";

const router = Router();
const STAGE_ORDER = ["greenware", "bisqueware", "fired"];

function collectStagePhotos(stageRecords) {
  if (!Array.isArray(stageRecords)) return [];
  return stageRecords.flatMap((r) => r.photos || []);
}

// GET /?userId=xxx
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    const pieces = userId ? Pieces.listForUser(userId) : [];
    res.json({ pieces });
  } catch (error) {
    console.error("Get pieces error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /:id — open to anyone (anonymous OK); returns `viewerAccess` so the
// client can render edit affordances only when the caller has the rights.
router.get(
  "/:id",
  optionalVerifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "viewer",
  }),
  async (req, res) => {
    try {
      res.json({ piece: req.resource, viewerAccess: req.access });
    } catch (error) {
      console.error("Get piece error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST / — create a new piece for the authenticated user.
router.post("/", verifyUser, async (req, res) => {
  try {
    const { name, clayBody, notes, weight } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    const now = new Date().toISOString();
    const id = `piece-${Date.now()}-${randomUUID().slice(0, 8)}`;
    Pieces.insert({
      id,
      userId: req.uid,
      name,
      clayBody: clayBody ?? null,
      notes: notes ?? null,
      weight: weight ?? null,
      currentStage: "greenware",
      stageRecords: [],
      glazes: [],
      inspoCollectionId: null,
      publishedEntries: [],
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    // Every piece gets a hidden inspo collection eagerly so the rest of the
    // app can treat `piece.inspoCollectionId` as a non-null invariant.
    Pieces.createInspoCollection(id, req.uid);
    res.json({ piece: Pieces.get(id) });
  } catch (error) {
    console.error("Create piece error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id — partial update; owner or editor (added member).
router.put(
  "/:id",
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "editor",
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = req.resource;

      const {
        name,
        clayBody,
        notes,
        weight,
        currentStage,
        stageRecords,
        glazes,
        publishedEntries,
        isArchived,
      } = req.body;

      // If stageRecords is being rewritten, delete any photos this piece owns
      // that are not in the new version.
      if (stageRecords !== undefined) {
        const oldPhotos = collectStagePhotos(existing.stageRecords);
        const newPhotos = new Set(collectStagePhotos(stageRecords));
        for (const url of oldPhotos) {
          if (newPhotos.has(url)) continue;
          if (getPhotoOwner(url) !== "piece") continue;
          await deleteImage(url);
        }
      }

      const updated = Pieces.update(id, {
        ...(name !== undefined && { name }),
        ...(clayBody !== undefined && { clayBody }),
        ...(notes !== undefined && { notes }),
        ...(weight !== undefined && { weight }),
        ...(currentStage !== undefined && { currentStage }),
        ...(stageRecords !== undefined && { stageRecords }),
        ...(glazes !== undefined && { glazes }),
        ...(publishedEntries !== undefined && { publishedEntries }),
        ...(isArchived !== undefined && { isArchived }),
      });
      res.json({ piece: updated });
    } catch (error) {
      console.error("Update piece error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// PATCH /:id/inspo was removed when piece inspo moved to an attached
// collection. Clients now mutate the inspo collection directly via
// `PUT /api/collections/:inspoCollectionId`.

// DELETE /:id — delete a piece (and any photos it owns); owner only.
router.delete(
  "/:id",
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "owner",
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      for (const url of collectStagePhotos(req.resource.stageRecords)) {
        if (getPhotoOwner(url) !== "piece") continue;
        await deleteImage(url);
      }
      // Cascade: the piece's inspo collection is owned by the piece, so it
      // goes with it. Photos referenced by the inspo collection's likes are
      // not the piece's to delete (they belong to the underlying glaze or
      // combination upload), so there's nothing more to clean up.
      if (req.resource.inspoCollectionId) {
        ResourceMembers.removeAllFor("collection", req.resource.inspoCollectionId);
        Collections.delete(req.resource.inspoCollectionId);
      }
      ResourceMembers.removeAllFor("piece", id);
      Pieces.delete(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete piece error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /:id/photo — add a stage photo; owner or editor.
router.post(
  "/:id/photo",
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "editor",
  }),
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { stage, stageNotes } = req.body;
      if (!req.file) return res.status(400).json({ error: "No image provided" });
      if (!stage) return res.status(400).json({ error: "stage is required" });

      const existing = req.resource;

      const filename = `${Date.now()}.jpg`;
      const input = useAzureStorage ? req.file.buffer : req.file.path;
      const processed = await processImage(input);
      const imageUrl = await savePieceImage(processed, req.uid, filename);
      if (!useAzureStorage && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      const stageRecords = [...(existing.stageRecords || [])];
      const idx = stageRecords.findIndex((r) => r.stage === stage);
      if (idx >= 0) {
        stageRecords[idx] = {
          ...stageRecords[idx],
          photos: [...(stageRecords[idx].photos || []), imageUrl],
          ...(stageNotes !== undefined && { notes: stageNotes }),
        };
      } else {
        stageRecords.push({
          stage,
          date: new Date().toISOString(),
          photos: [imageUrl],
          notes: stageNotes || null,
        });
      }

      const currentIdx = STAGE_ORDER.indexOf(existing.currentStage);
      const newIdx = STAGE_ORDER.indexOf(stage);
      const currentStage = newIdx > currentIdx ? stage : existing.currentStage;

      const updated = Pieces.update(id, { stageRecords, currentStage });
      res.json({ piece: updated, imageUrl });
    } catch (error) {
      console.error("Piece photo upload error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// DELETE /:id/photo — remove a stage photo; owner or editor.
router.delete(
  "/:id/photo",
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "editor",
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { stage, photoUrl } = req.query;
      if (!stage || !photoUrl) {
        return res.status(400).json({ error: "stage and photoUrl are required" });
      }

      const stageRecords = (req.resource.stageRecords || []).map((r) =>
        r.stage === stage
          ? { ...r, photos: (r.photos || []).filter((u) => u !== photoUrl) }
          : r,
      );
      const updated = Pieces.update(id, { stageRecords });

      if (getPhotoOwner(photoUrl) === "piece") {
        try {
          await deleteImage(photoUrl);
        } catch {
          /* best-effort */
        }
      }
      res.json({ piece: updated });
    } catch (error) {
      console.error("Piece photo delete error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
