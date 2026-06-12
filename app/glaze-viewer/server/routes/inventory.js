/**
 * /api/inventory — shared studio inventory.
 *
 * Reads are public (signed-out visitors see real ownership state so the
 * `?onlyOwned` filters work for them too). Writes are admin-only because
 * the inventory is a fact about the physical studio, not a personal
 * preference — random signed-in users shouldn't be able to flip it.
 */

import { Router } from "express";
import { verifyAdmin } from "../middleware/auth.js";
import { Inventory } from "../lib/repositories.js";

const router = Router();

// GET / — public read.
router.get("/", (req, res) => {
  try {
    res.json(Inventory.get());
  } catch (error) {
    console.error("Inventory get error:", error);
    res.status(500).json({ error: "Failed to read inventory" });
  }
});

// POST / — admin only. Body: { ownedGlazeIds: string[] }.
router.post("/", verifyAdmin, (req, res) => {
  try {
    const ids = req.body?.ownedGlazeIds;
    if (!Array.isArray(ids)) {
      return res
        .status(400)
        .json({ error: "ownedGlazeIds must be an array of strings" });
    }
    res.json(Inventory.save(ids, req.uid));
  } catch (error) {
    console.error("Inventory save error:", error);
    res.status(500).json({ error: "Failed to save inventory" });
  }
});

export default router;
