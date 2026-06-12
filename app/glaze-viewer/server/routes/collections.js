/**
 * /api/collections \u2014 saved inspiration boards (SQLite).

 */

import { Router } from "express";
import { randomUUID } from "crypto";
import { Collections, ResourceMembers } from "../lib/repositories.js";
import { verifyUser, optionalVerifyUser } from "../middleware/auth.js";
import { loadAndAuthorize } from "../middleware/loadAndAuthorize.js";

const router = Router();

function envelope(c) {
  return { collection: c };
}

function envelopeList(list) {
  return { collections: list };
}

// GET /item/:id — fetch one collection by id. Open to anyone (anonymous OK)
// for parity with `GET /api/pieces/:id`; the response carries `viewerAccess`
// so the client can gate edit UI. For an inspo collection
// (`attachedToPieceId != null`), access is resolved against the parent
// piece. Lives at /item/:id (not /:id) so it doesn't collide with the
// list-by-user route at /:userId.
router.get(
  "/item/:id",
  optionalVerifyUser,
  loadAndAuthorize(Collections, "id", {
    notFound: "Collection not found",
    resourceType: "collection",
    require: "viewer",
  }),
  async (req, res) => {
    res.json({ ...envelope(req.resource), viewerAccess: req.access });
  },
);

// GET /:userId — read another user's collections (public profile view).
// Reads are intentionally open so the profile page works for any user.
// Piece-attached inspo collections are hidden by the repository.
router.get("/:userId", async (req, res) => {
  try {
    res.json(envelopeList(Collections.listForUser(req.params.userId)));
  } catch (error) {
    console.error("Get collections error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST / — create a collection for the authenticated user.
router.post("/", verifyUser, async (req, res) => {
  try {
    const { name, notes, likes, swipeProgress } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    const now = new Date().toISOString();
    const created = Collections.insert({
      id: `collection-${Date.now()}-${randomUUID().slice(0, 8)}`,
      userId: req.uid,
      name,
      notes: notes ?? null,
      likes: likes || [],
      swipeProgress: swipeProgress ?? null,
      createdAt: now,
      updatedAt: now,
    });
    res.json(envelope(created));
  } catch (error) {
    console.error("Create collection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id — update a collection; owner or editor (and inspo collections
// resolve access via the parent piece).
router.put(
  "/:id",
  verifyUser,
  loadAndAuthorize(Collections, "id", {
    notFound: "Collection not found",
    resourceType: "collection",
    require: "editor",
  }),
  async (req, res) => {
    try {
      const { name, notes, likes, swipeProgress } = req.body;
      const updated = Collections.update(req.params.id, {
        ...(name !== undefined && { name }),
        ...(notes !== undefined && { notes }),
        ...(likes !== undefined && { likes }),
        ...(swipeProgress !== undefined && { swipeProgress }),
      });
      res.json(envelope(updated));
    } catch (error) {
      console.error("Update collection error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// DELETE /:id — delete a collection; owner only.
router.delete(
  "/:id",
  verifyUser,
  loadAndAuthorize(Collections, "id", {
    notFound: "Collection not found",
    resourceType: "collection",
    require: "owner",
  }),
  async (req, res) => {
    try {
      ResourceMembers.removeAllFor("collection", req.params.id);
      Collections.delete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete collection error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
