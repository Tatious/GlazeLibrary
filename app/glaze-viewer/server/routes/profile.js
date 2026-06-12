/**
 * /api/profile — public profile lookup.
 *
 * Lets the client fetch another user's display name / role without importing
 * `firebase/firestore` directly. The actual data lives in the Firestore
 * `profiles` collection (Spark tier), this just proxies through so the
 * frontend only talks to /api/*.
 *
 * Read-only and public — profile docs contain no secrets, just display name +
 * role, and other endpoints already expose collections / uploads under
 * `/api/collections/:userId` etc.
 */

import { Router } from "express";
import { adminDb } from "../lib/firebase-admin.js";

const router = Router();

// GET /:userId
router.get("/:userId", async (req, res) => {
  if (!adminDb) {
    return res.status(500).json({ error: "Server not configured" });
  }
  try {
    const snap = await adminDb
      .collection("profiles")
      .doc(req.params.userId)
      .get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({ profile: snap.data() });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
