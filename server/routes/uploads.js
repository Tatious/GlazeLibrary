/**
 * /api/upload + /api/user-combinations \u2014 community combo entries (SQLite).
 *
 * Photo ownership: when an upload references a photo URL belonging to another
 * feature (e.g. publishing a piece's fired photo), `assembleImages` COPIES
 * the file into the upload's namespace. Deleting the piece never affects the
 * upload, and vice versa.
 */

import { Router } from "express";
import { randomUUID } from "crypto";
import { deleteImage, getPhotoOwner } from "../storage.js";
import { upload, assembleImages } from "../lib/images.js";
import { makeCombinationId } from "../lib/combinationId.js";
import { Pieces, Uploads } from "../lib/repositories.js";
import { verifyUser } from "../middleware/auth.js";
import { loadAndAuthorize } from "../middleware/loadAndAuthorize.js";
import { parseJsonOrDefault } from "../lib/json.js";

const router = Router();

// Multer leaves `req.body` untouched when the request isn't multipart
// (bot probes, malformed clients, `curl -X POST` with no body). Without this
// guard the first `req.body.X` read throws `Cannot read properties of
// undefined`. Apply to every multipart route below so the handlers can
// destructure freely.
function ensureBody(req, _res, next) {
  if (req.body == null) req.body = {};
  next();
}

async function deleteOwnedPhotos(urls) {
  for (const url of urls) {
    if (getPhotoOwner(url) !== "upload") continue;
    await deleteImage(url);
  }
}

// POST /api/upload — create a new entry for the authenticated user.
router.post(
  "/upload",
  verifyUser,
  upload.array("images", 10),
  ensureBody,
  async (req, res) => {
  try {
    const slotOrder = parseJsonOrDefault(req.body.slotOrder, null);
    const existingPieceUrls = parseJsonOrDefault(req.body.existingPieceUrls, []);
    const hasSlotContent = Array.isArray(slotOrder) && slotOrder.length > 0;

    if (
      (!req.files || req.files.length === 0) &&
      existingPieceUrls.length === 0 &&
      !hasSlotContent
    ) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const userId = req.uid;
    const {
      topGlazeId,
      bottomGlazeId,
      topCoats,
      bottomCoats,
      cone,
      clayBody,
      notes,
      tags,
    } = req.body;
    const parsedTags = parseJsonOrDefault(tags, []);

    const imageUrls = await assembleImages({
      files: req.files || [],
      slotOrder,
      existingFallback: existingPieceUrls,
      userId,
      destOwner: "upload",
    });

    const combinationId = makeCombinationId(topGlazeId, bottomGlazeId);
    const isSingleGlaze = !!(topGlazeId && !bottomGlazeId);

    const entry = Uploads.insert({
      id: randomUUID(),
      combinationId,
      userId,
      isSingleGlaze,
      topGlazeId: topGlazeId || null,
      bottomGlazeId: bottomGlazeId || null,
      topCoats: parseInt(topCoats) || 2,
      bottomCoats: parseInt(bottomCoats) || 2,
      cone: cone || null,
      clayBody: clayBody || null,
      notes: notes || null,
      tags: parsedTags,
      imageUrls,
      createdAt: new Date().toISOString(),
    });

    // If the upload was published from a piece, link the entry back to it so
    // PieceDetailPage's "Published results" section knows about it. Best-effort
    // — a missing or foreign piece is silently ignored so the upload still
    // succeeds.
    const pieceId = req.body.pieceId || req.body.piece;
    let linkedPieceId = null;
    if (pieceId) {
      try {
        const piece = Pieces.get(pieceId);
        if (piece && piece.userId === userId) {
          const already = (piece.publishedEntries || []).some(
            (p) => p.entryId === entry.id,
          );
          if (!already) {
            Pieces.update(pieceId, {
              publishedEntries: [
                ...(piece.publishedEntries || []),
                { comboId: combinationId, entryId: entry.id },
              ],
            });
          }
          linkedPieceId = pieceId;
        }
      } catch (err) {
        console.error("Link to piece failed:", err.message);
      }
    }

    res.json({
      success: true,
      combination: entry,
      combinationId,
      entryId: entry.id,
      isSingleGlaze,
      pieceId: linkedPieceId,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/user-combinations \u2014 list all uploads (legacy shape preserved)
router.get("/user-combinations", async (req, res) => {
  try {
    res.json({ combinations: Uploads.list() });
  } catch (error) {
    console.error("Error reading combinations:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/user-combinations/:id — owner only.
router.delete(
  "/user-combinations/:id",
  verifyUser,
  loadAndAuthorize(Uploads, "id", { notFound: "Combination not found" }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = req.resource;
      const urls = existing.imageUrls || (existing.imageUrl ? [existing.imageUrl] : []);
      await deleteOwnedPhotos(urls);
      Uploads.delete(id);

      // Unlink this entry from any piece's publishedEntries so the piece's
      // "Published results" doesn't show a card pointing to a deleted upload.
      if (existing.userId) {
        for (const piece of Pieces.listForUser(existing.userId)) {
          const linked = piece.publishedEntries || [];
          if (!linked.some((p) => p.entryId === id)) continue;
          Pieces.update(piece.id, {
            publishedEntries: linked.filter((p) => p.entryId !== id),
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// PUT /api/user-combinations/:id — owner only.
router.put(
  "/user-combinations/:id",
  verifyUser,
  loadAndAuthorize(Uploads, "id", { notFound: "Entry not found" }),
  upload.array("images", 10),
  ensureBody,
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = req.resource;

      const {
        topGlazeId,
        bottomGlazeId,
        topCoats,
        bottomCoats,
        cone,
        clayBody,
        notes,
        tags,
      } = req.body;
      const parsedTags = parseJsonOrDefault(tags, existing.tags || []);
      const slotOrder = parseJsonOrDefault(req.body.slotOrder, null);

      const existingImageUrls = existing.imageUrls || (existing.imageUrl ? [existing.imageUrl] : []);
      const userId = existing.userId;

      const imageUrls = await assembleImages({
        files: req.files || [],
        slotOrder,
        existingFallback: existingImageUrls,
        userId,
        destOwner: "upload",
      });

      const kept = new Set(imageUrls);
      for (const url of existingImageUrls) {
        if (kept.has(url)) continue;
        if (getPhotoOwner(url) !== "upload") continue;
        await deleteImage(url);
      }

      const nextTop = topGlazeId !== undefined ? topGlazeId : existing.topGlazeId;
      const nextBottom = bottomGlazeId !== undefined ? bottomGlazeId : existing.bottomGlazeId;

      const updated = Uploads.update(id, {
        topGlazeId: nextTop,
        bottomGlazeId: nextBottom,
        topCoats: topCoats !== undefined ? parseInt(topCoats) : existing.topCoats,
        bottomCoats:
          bottomCoats !== undefined ? parseInt(bottomCoats) : existing.bottomCoats,
        cone: cone !== undefined ? cone.trim() || null : existing.cone,
        clayBody:
          clayBody !== undefined ? clayBody.trim() || null : existing.clayBody,
        notes: notes !== undefined ? notes.trim() || null : existing.notes,
        tags: parsedTags,
        imageUrls,
        combinationId:
          topGlazeId !== undefined || bottomGlazeId !== undefined
            ? makeCombinationId(nextTop, nextBottom)
            : existing.combinationId,
      });

      res.json({
        success: true,
        entry: updated,
        combinationId: updated.combinationId,
        entryId: updated.id,
      });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
