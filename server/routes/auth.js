/**
 * Auth routes (signup with invite-code, delete-own-account).
 *
 * Invite codes + profile docs live in Firestore (Spark / free tier).
 * No content data here.
 */

import { Router } from "express";
import { adminAuth, adminDb } from "../lib/firebase-admin.js";
import { verifyUser } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rate-limit.js";
import { UserData } from "../lib/repositories.js";
import { deleteImage, getPhotoOwner } from "../storage.js";

const router = Router();

// POST /api/auth/signup — create new user with invite-code validation
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { email, password, displayName, inviteCode } = req.body;
    if (!email || !password || !displayName || !inviteCode) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (!adminDb || !adminAuth) {
      return res.status(500).json({ error: "Server not configured" });
    }

    const codesSnap = await adminDb
      .collection("invite_codes")
      .where("code", "==", inviteCode.trim())
      .where("used_by", "==", null)
      .limit(1)
      .get();
    if (codesSnap.empty) {
      return res
        .status(400)
        .json({ error: "Invalid or already used invite code" });
    }
    const codeDoc = codesSnap.docs[0];

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({ email, password, displayName });
    } catch (authErr) {
      return res.status(400).json({ error: authErr.message });
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();
    batch.set(adminDb.collection("profiles").doc(userRecord.uid), {
      id: userRecord.uid,
      display_name: displayName,
      role: "user",
      created_at: now,
      updated_at: now,
    });
    batch.update(codeDoc.ref, { used_by: userRecord.uid, used_at: now });

    try {
      await batch.commit();
    } catch (batchErr) {
      await adminAuth.deleteUser(userRecord.uid).catch(() => {});
      throw batchErr;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: error.message || "Signup failed" });
  }
});

// DELETE /api/account — delete own account
router.delete("/account", authLimiter, verifyUser, async (req, res) => {
  if (!adminAuth || !adminDb) {
    return res.status(500).json({ error: "Server not configured" });
  }
  try {
    // Cascade SQLite content first so we never have orphaned rows pointing at
    // a deleted Firebase user. Photos are best-effort — a blob failure here
    // shouldn't block the account delete.
    const { photoUrls } = UserData.purge(req.uid);
    for (const url of photoUrls) {
      if (getPhotoOwner(url) !== "piece" && getPhotoOwner(url) !== "upload") {
        continue;
      }
      try {
        await deleteImage(url);
      } catch (err) {
        console.error("Account purge: photo delete failed for", url, err.message);
      }
    }

    await adminAuth.deleteUser(req.uid);
    await adminDb.collection("profiles").doc(req.uid).delete();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
