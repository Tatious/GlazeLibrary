/**
 * /api/config \u2014 per-user my-glazes config (SQLite).
 *
 * Previously: a single global JSON file. Two users editing it would clobber
 * each other's owned glazes / favorites. SQLite + verified Firebase token
 * keys the document by `user_id` so that bug is gone.
 *
 * Unauthenticated reads return a default empty config so the client renders
 * cleanly; unauthenticated writes are rejected.
 */

import { Router } from "express";
import { verifyUser } from "../middleware/auth.js";
import { MyGlazes } from "../lib/repositories.js";

const router = Router();

// GET / \u2014 read current user's config; defaults if unauth.
router.get("/", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.json({
      version: "2.0",
      glazes: {},
      favoriteCombinations: [],
      lastUpdated: new Date(0).toISOString(),
    });
  }
  return verifyUser(req, res, () => {
    try {
      res.json(MyGlazes.get(req.uid));
    } catch (error) {
      console.error("MyGlazes get error:", error);
      res.status(500).json({ error: "Failed to read config" });
    }
  });
});

// POST / \u2014 save config for the authenticated user.
router.post("/", verifyUser, async (req, res) => {
  try {
    const saved = MyGlazes.save(req.uid, req.body || {});
    res.json({ success: true, config: saved });
  } catch (error) {
    console.error("Error saving config:", error);
    res.status(500).json({ error: "Failed to save config" });
  }
});

export default router;
