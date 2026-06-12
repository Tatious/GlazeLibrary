/**
 * /api/admin \u2014 invite codes + role + user-delete (Firebase Auth + Firestore).
 *
 * Profiles + invite_codes live in Firestore (free Spark tier). No content
 * data here.
 */

import { Router } from "express";
import { adminAuth, adminDb } from "../lib/firebase-admin.js";
import { verifyAdmin } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/rate-limit.js";
import { UserData } from "../lib/repositories.js";
import { deleteImage, getPhotoOwner } from "../storage.js";

const router = Router();

// GET /invite-codes
router.get("/invite-codes", verifyAdmin, async (req, res) => {
  try {
    const snap = await adminDb
      .collection("invite_codes")
      .orderBy("created_at", "desc")
      .get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (error) {
    console.error("Fetch invite codes error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /users — admin-only list of every profile (newest first).
// Previously the AdminPage queried Firestore directly; routing through the
// server keeps the API surface uniform and means the client never needs to
// know the Firestore collection layout.
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const snap = await adminDb
      .collection("profiles")
      .orderBy("created_at", "desc")
      .get();
    res.json(snap.docs.map((d) => d.data()));
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /invite-codes
router.post("/invite-codes", verifyAdmin, adminLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "code is required" });
    const now = new Date().toISOString();
    const ref = await adminDb.collection("invite_codes").add({
      code,
      created_by: req.uid,
      used_by: null,
      used_at: null,
      created_at: now,
    });
    res.json({
      id: ref.id,
      code,
      created_by: req.uid,
      used_by: null,
      used_at: null,
      created_at: now,
    });
  } catch (error) {
    console.error("Create invite code error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /invite-codes/:id
router.delete("/invite-codes/:id", verifyAdmin, adminLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const codeDoc = await adminDb.collection("invite_codes").doc(id).get();
    if (!codeDoc.exists) {
      return res.status(404).json({ error: "Code not found" });
    }
    if (codeDoc.data().used_by) {
      return res
        .status(400)
        .json({ error: "Cannot revoke an already used code" });
    }
    await adminDb.collection("invite_codes").doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error("Revoke invite code error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /update-role
router.post("/update-role", verifyAdmin, adminLimiter, async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    if (!userId || !newRole) {
      return res.status(400).json({ error: "userId and newRole are required" });
    }
    if (newRole !== "admin" && newRole !== "user") {
      return res
        .status(400)
        .json({ error: "newRole must be 'admin' or 'user'" });
    }
    await adminDb.collection("profiles").doc(userId).update({ role: newRole });
    res.json({ success: true, userId, newRole });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /delete-user/:userId
router.delete("/delete-user/:userId", verifyAdmin, adminLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.uid) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }
    // Cascade SQLite first so we never have orphaned uploads/collections/pieces
    // pointing at a deleted Firebase user. Photos are best-effort.
    const { photoUrls } = UserData.purge(userId);
    for (const url of photoUrls) {
      if (getPhotoOwner(url) !== "piece" && getPhotoOwner(url) !== "upload") {
        continue;
      }
      try {
        await deleteImage(url);
      } catch (err) {
        console.error("Admin purge: photo delete failed for", url, err.message);
      }
    }

    await adminAuth.deleteUser(userId);
    await adminDb.collection("profiles").doc(userId).delete();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
