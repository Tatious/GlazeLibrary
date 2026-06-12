/**
 * Middleware factory: 404 / 403 ladder used by route handlers that need a
 * loaded resource + access check.
 *
 * Two modes:
 *
 *   // Default — owner-only (backwards compatible).
 *   router.delete(
 *     "/:id",
 *     verifyUser,
 *     loadAndAuthorize(Pieces),
 *     handler,
 *   );
 *
 *   // Tiered — owner OR added editor OR (any signed-in or anonymous) viewer.
 *   router.get(
 *     "/:id",
 *     optionalVerifyUser,
 *     loadAndAuthorize(Pieces, "id", { resourceType: "piece", require: "viewer" }),
 *     handler,
 *   );
 *
 * Behavior:
 *   - 404 if `repo.get(id)` returns null.
 *   - Attaches `req.resource` and `req.access` ('owner' | 'editor' | 'viewer').
 *   - For `require: 'owner'` (default), no `resourceType` is needed and the
 *     check is the original `resource.userId === req.uid` (401 if no uid,
 *     403 otherwise) — drop-in compatible with every existing call site.
 *   - For `require: 'editor' | 'viewer'`, consults `ResourceMembers` and
 *     defers access for inspo collections (attachedToPieceId != null) to
 *     the parent piece.
 *
 * `require: 'viewer'` allows anonymous (`req.uid == null`) callers, matching
 * the existing public-read behavior of `GET /api/pieces/:id`.
 */

import { Pieces, ResourceMembers } from "../lib/repositories.js";

const TIER_RANK = { viewer: 0, editor: 1, owner: 2 };

function resolveAccess({ resourceType, resource, uid }) {
  // Inspo collections never have independent access — defer to the parent
  // piece so a piece's editor automatically gets editor on its inspo board.
  if (resourceType === "collection" && resource.attachedToPieceId) {
    const piece = Pieces.get(resource.attachedToPieceId);
    if (!piece) return { access: "viewer", parentMissing: true };
    return resolveAccess({ resourceType: "piece", resource: piece, uid });
  }
  if (uid && resource.userId === uid) return { access: "owner" };
  if (uid) {
    // `getRole` can return null, 'editor', or — once the transfer-ownership
    // flow ships — 'owner'. Map both explicitly so a future 'owner' row
    // can't silently demote to viewer.
    const memberRole = ResourceMembers.getRole(resourceType, resource.id, uid);
    if (memberRole === "owner") return { access: "owner" };
    if (memberRole === "editor") return { access: "editor" };
  }
  return { access: "viewer" };
}

export function loadAndAuthorize(repo, paramName = "id", options = {}) {
  const { notFound = "Not found", resourceType, require: requiredTier = "owner" } = options;

  return (req, res, next) => {
    const id = req.params[paramName];
    const resource = repo.get(id);
    if (!resource) return res.status(404).json({ error: notFound });

    // Fast path: owner-only check works without a resourceType, preserving
    // the original middleware contract for routes that haven't opted in.
    if (requiredTier === "owner" && !resourceType) {
      if (!req.uid) return res.status(401).json({ error: "Unauthorized" });
      if (resource.userId !== req.uid) return res.status(403).json({ error: "Forbidden" });
      req.resource = resource;
      req.access = "owner";
      return next();
    }

    if (!resourceType) {
      throw new Error(
        `loadAndAuthorize: 'resourceType' is required when require='${requiredTier}'`,
      );
    }

    const { access, parentMissing } = resolveAccess({
      resourceType,
      resource,
      uid: req.uid ?? null,
    });
    if (parentMissing) return res.status(404).json({ error: notFound });

    if (TIER_RANK[access] < TIER_RANK[requiredTier]) {
      return res
        .status(req.uid ? 403 : 401)
        .json({ error: req.uid ? "Forbidden" : "Unauthorized" });
    }

    req.resource = resource;
    req.access = access;
    next();
  };
}
