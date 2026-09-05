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
import { adminAuth, adminDb } from "../lib/firebase-admin.js";
import { verifyUser, optionalVerifyUser } from "../middleware/auth.js";
import { loadAndAuthorize } from "../middleware/loadAndAuthorize.js";
import { peopleSearchLimiter } from "../middleware/rate-limit.js";

const router = Router();
const STAGE_ORDER = ["greenware", "bisqueware", "fired"];

function collectStagePhotos(stageRecords) {
  if (!Array.isArray(stageRecords)) return [];
  return stageRecords.flatMap((r) => r.photos || []);
}

async function getProfileSummary(userId, includeEmail = false) {
  const [profileSnap, authUser] = await Promise.all([
    adminDb?.collection("profiles").doc(userId).get(),
    includeEmail && adminAuth
      ? adminAuth.getUser(userId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const profile = profileSnap?.exists ? profileSnap.data() : null;
  return {
    userId,
    displayName: profile?.display_name || authUser?.displayName || "Glaze Library user",
    photoDataUrl: profile?.photo_data_url || null,
    ...(includeEmail && { email: authUser?.email || null }),
  };
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

// GET /mine — owned pieces, accepted collaborations, and invitations for the
// signed-in user. Kept separate from the public user profile listing above.
router.get("/mine", verifyUser, async (req, res) => {
  try {
    const owned = Pieces.listForUser(req.uid).map((piece) => ({
      ...piece,
      viewerAccess: "owner",
    }));
    const memberships = ResourceMembers.listForUser("piece", req.uid);
    const entries = await Promise.all(
      memberships.map(async (membership) => {
        const piece = Pieces.get(membership.resourceId);
        if (!piece) return null;
        return {
          piece: {
            ...piece,
            viewerAccess:
              membership.status === "accepted" ? membership.role : "viewer",
          },
          owner: await getProfileSummary(piece.userId),
          invitedAt: membership.addedAt,
          status: membership.status,
        };
      }),
    );
    const validEntries = entries.filter(Boolean);
    res.json({
      owned,
      shared: validEntries
        .filter((entry) => entry.status === "accepted")
        .map(({ piece, owner }) => ({ piece, owner })),
      invitations: validEntries
        .filter((entry) => entry.status === "pending")
        .map(({ piece, owner, invitedAt }) => ({
          piece: { id: piece.id, name: piece.name },
          owner,
          invitedAt,
        })),
    });
  } catch (error) {
    console.error("Get my pieces error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /:id/collaborators — owner-only member management.
router.get(
  "/:id/collaborators",
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "owner",
  }),
  async (req, res) => {
    try {
      const collaborators = await Promise.all(
        ResourceMembers.list("piece", req.params.id).map(async (member) => ({
          ...member,
          profile: await getProfileSummary(member.userId, true),
        })),
      );
      res.json({ collaborators });
    } catch (error) {
      console.error("Get collaborators error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /:id/people/search — owner-only people picker. Search terms stay out
// of URLs and server access logs. Name matches expose only public profile
// fields; a full email match may echo the exact address already entered.
router.post(
  "/:id/people/search",
  peopleSearchLimiter,
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "owner",
  }),
  async (req, res) => {
    if (!adminAuth || !adminDb) {
      return res.status(500).json({ error: "Server not configured" });
    }
    const query = String(req.body.query || "").trim();
    if (query.length < 2) return res.json({ people: [] });
    try {
      const excludedUserIds = new Set([
        req.uid,
        ...ResourceMembers.list("piece", req.params.id).map((member) => member.userId),
      ]);
      let people = [];
      if (query.includes("@")) {
        const emailUser = await adminAuth
          .getUserByEmail(query.toLowerCase())
          .catch(() => null);
        if (
          emailUser &&
          !excludedUserIds.has(emailUser.uid)
        ) {
          people.push(await getProfileSummary(emailUser.uid, true));
        }
      } else {
        const variants = Array.from(new Set([
          query,
          query.toLowerCase(),
          query.charAt(0).toUpperCase() + query.slice(1).toLowerCase(),
          query.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        ]));
        const snapshots = await Promise.all(
          variants.map((prefix) =>
            adminDb
              .collection("profiles")
              .orderBy("display_name")
              .startAt(prefix)
              .endAt(`${prefix}\uf8ff`)
              .limit(8)
              .get(),
          ),
        );
        const matches = new Map();
        for (const snapshot of snapshots) {
          for (const doc of snapshot.docs) {
            if (!excludedUserIds.has(doc.id)) matches.set(doc.id, doc.data());
          }
        }
        people = Array.from(matches, ([userId, profile]) => ({
          userId,
          displayName: profile.display_name || "Glaze Library user",
          photoDataUrl: profile.photo_data_url || null,
        }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
          .slice(0, 8);
      }
      res.json({ people });
    } catch (error) {
      console.error("Search people error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /:id/invitations — invite an existing account by selected user id or
// typed email; owner only.
router.post(
  "/:id/invitations",
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "owner",
  }),
  async (req, res) => {
    if (!adminAuth || !adminDb) {
      return res.status(500).json({ error: "Server not configured" });
    }
    const userId = String(req.body.userId || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!userId && !email) {
      return res.status(400).json({ error: "Choose a person or enter an email" });
    }
    try {
      const invitedUser = userId
        ? await adminAuth.getUser(userId)
        : await adminAuth.getUserByEmail(email);
      if (invitedUser.uid === req.uid) {
        return res.status(400).json({ error: "You already own this piece" });
      }
      const existing = ResourceMembers.get("piece", req.params.id, invitedUser.uid);
      if (existing) {
        return res.status(409).json({
          error:
            existing.status === "pending"
              ? "That user already has a pending invitation"
              : "That user is already an editor",
        });
      }
      const member = ResourceMembers.invite(
        "piece",
        req.params.id,
        invitedUser.uid,
        "editor",
        req.uid,
      );
      res.status(201).json({
        collaborator: {
          ...member,
          profile: await getProfileSummary(invitedUser.uid, true),
        },
      });
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        return res.status(404).json({ error: "No account uses that email" });
      }
      console.error("Invite collaborator error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// PATCH /:id/invitations/me — invitees explicitly accept or reject.
router.patch("/:id/invitations/me", verifyUser, async (req, res) => {
  try {
    const piece = Pieces.get(req.params.id);
    if (!piece) return res.status(404).json({ error: "Piece not found" });
    const invitation = ResourceMembers.get("piece", req.params.id, req.uid);
    if (!invitation || invitation.status !== "pending") {
      return res.status(404).json({ error: "Invitation not found" });
    }
    if (req.body.action === "accept") {
      ResourceMembers.accept("piece", req.params.id, req.uid);
      return res.json({ piece: { ...Pieces.get(req.params.id), viewerAccess: "editor" } });
    }
    if (req.body.action === "reject") {
      ResourceMembers.remove("piece", req.params.id, req.uid);
      return res.json({ success: true });
    }
    return res.status(400).json({ error: "Action must be accept or reject" });
  } catch (error) {
    console.error("Respond to invitation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id/collaborators/:userId — revoke a pending or accepted member.
router.delete(
  "/:id/collaborators/:userId",
  verifyUser,
  loadAndAuthorize(Pieces, "id", {
    notFound: "Piece not found",
    resourceType: "piece",
    require: "owner",
  }),
  async (req, res) => {
    try {
      ResourceMembers.remove("piece", req.params.id, req.params.userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove collaborator error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

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

      if (isArchived !== undefined && req.access !== "owner") {
        return res.status(403).json({ error: "Only the owner can archive this piece" });
      }

      let removedPhotoUrls = [];
      if (stageRecords !== undefined) {
        const oldPhotos = collectStagePhotos(existing.stageRecords);
        const oldPhotoSet = new Set(oldPhotos);
        const newPhotos = new Set(collectStagePhotos(stageRecords));
        if ([...newPhotos].some((url) => !oldPhotoSet.has(url))) {
          return res.status(400).json({
            error: "Photos must be added through the piece photo upload",
          });
        }
        removedPhotoUrls = oldPhotos.filter(
          (url) => !newPhotos.has(url) && getPhotoOwner(url) === "piece",
        );
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
      for (const url of removedPhotoUrls) {
        try {
          await deleteImage(url);
        } catch (error) {
          console.error("Piece update: photo cleanup failed for", url, error.message);
        }
      }
      res.json({ piece: { ...updated, viewerAccess: req.access } });
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
      const ownedPhotoUrls = collectStagePhotos(req.resource.stageRecords).filter(
        (url) => getPhotoOwner(url) === "piece",
      );
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
      for (const url of ownedPhotoUrls) {
        try {
          await deleteImage(url);
        } catch (error) {
          console.error("Piece delete: photo cleanup failed for", url, error.message);
        }
      }
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
      res.json({ piece: { ...updated, viewerAccess: req.access }, imageUrl });
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

      const requestedStage = String(stage);
      const requestedPhotoUrl = String(photoUrl);
      const stageRecord = (req.resource.stageRecords || []).find(
        (record) => record.stage === requestedStage,
      );
      if (!stageRecord?.photos?.includes(requestedPhotoUrl)) {
        return res.status(404).json({ error: "Photo not found on this piece stage" });
      }

      const stageRecords = (req.resource.stageRecords || []).map((r) =>
        r.stage === requestedStage
          ? { ...r, photos: (r.photos || []).filter((u) => u !== requestedPhotoUrl) }
          : r,
      );
      const updated = Pieces.update(id, { stageRecords });

      if (getPhotoOwner(requestedPhotoUrl) === "piece") {
        try {
          await deleteImage(requestedPhotoUrl);
        } catch {
          /* best-effort */
        }
      }
      res.json({ piece: { ...updated, viewerAccess: req.access } });
    } catch (error) {
      console.error("Piece photo delete error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
