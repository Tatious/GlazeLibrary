/**
 * Repository helpers — pure SQLite, no HTTP. Each route file uses these
 * instead of touching `db` directly, which keeps SQL co-located with the
 * shape it produces and makes the routes thin.
 *
 * Shapes match the existing client/server contract exactly, so this is a
 * drop-in replacement for the read/write JSON helpers in storage.js.
 */

import db from "./db.js";
import { parseJsonOrDefault, stringifyOrNull } from "./json.js";

const j = stringifyOrNull;
const p = parseJsonOrDefault;

// ============================================================================
// Uploads (community combination entries)
// ============================================================================

function rowToUpload(row) {
  if (!row) return null;
  const imageUrls = p(row.image_urls_json, []);
  // Truth is bottom_glaze_id being null. The legacy column is kept for older
  // rows but derived here so callers only see one consistent shape.
  const isSingleGlaze = !row.bottom_glaze_id;
  return {
    id: row.id,
    userId: row.user_id,
    combinationId: row.combination_id,
    isSingleGlaze: isSingleGlaze || undefined,
    topGlazeId: row.top_glaze_id,
    bottomGlazeId: row.bottom_glaze_id,
    topCoats: row.top_coats,
    bottomCoats: row.bottom_coats,
    cone: row.cone,
    clayBody: row.clay_body,
    notes: row.notes,
    tags: p(row.tags_json, []),
    imageUrls,
    imageUrl: imageUrls[0],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const Uploads = {
  list() {
    return db
      .prepare("SELECT * FROM uploads ORDER BY datetime(created_at) DESC")
      .all()
      .map(rowToUpload);
  },
  get(id) {
    return rowToUpload(
      db.prepare("SELECT * FROM uploads WHERE id = ?").get(id),
    );
  },
  insert(entry) {
    db.prepare(
      `INSERT INTO uploads (
        id, user_id, combination_id, is_single_glaze,
        top_glaze_id, bottom_glaze_id, top_coats, bottom_coats,
        cone, clay_body, notes, tags_json, image_urls_json, created_at
      ) VALUES (
        @id, @userId, @combinationId, @isSingleGlaze,
        @topGlazeId, @bottomGlazeId, @topCoats, @bottomCoats,
        @cone, @clayBody, @notes, @tagsJson, @imageUrlsJson, @createdAt
      )`,
    ).run({
      id: entry.id,
      userId: entry.userId,
      combinationId: entry.combinationId,
      // The column is preserved for schema continuity but the truth is
      // `bottomGlazeId IS NULL` (see `rowToUpload`).
      isSingleGlaze: entry.bottomGlazeId ? 0 : 1,
      topGlazeId: entry.topGlazeId,
      bottomGlazeId: entry.bottomGlazeId,
      topCoats: entry.topCoats,
      bottomCoats: entry.bottomCoats,
      cone: entry.cone,
      clayBody: entry.clayBody,
      notes: entry.notes,
      tagsJson: j(entry.tags || []),
      imageUrlsJson: j(entry.imageUrls || []),
      createdAt: entry.createdAt,
    });
    return Uploads.get(entry.id);
  },
  update(id, updates) {
    const existing = Uploads.get(id);
    if (!existing) return null;
    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    db.prepare(
      `UPDATE uploads SET
        combination_id  = @combinationId,
        top_glaze_id    = @topGlazeId,
        bottom_glaze_id = @bottomGlazeId,
        top_coats       = @topCoats,
        bottom_coats    = @bottomCoats,
        cone            = @cone,
        clay_body       = @clayBody,
        notes           = @notes,
        tags_json       = @tagsJson,
        image_urls_json = @imageUrlsJson,
        updated_at      = @updatedAt
       WHERE id = @id`,
    ).run({
      id,
      combinationId: next.combinationId,
      topGlazeId: next.topGlazeId,
      bottomGlazeId: next.bottomGlazeId,
      topCoats: next.topCoats,
      bottomCoats: next.bottomCoats,
      cone: next.cone,
      clayBody: next.clayBody,
      notes: next.notes,
      tagsJson: j(next.tags || []),
      imageUrlsJson: j(next.imageUrls || []),
      updatedAt: next.updatedAt,
    });
    return Uploads.get(id);
  },
  delete(id) {
    return db.prepare("DELETE FROM uploads WHERE id = ?").run(id).changes > 0;
  },
};

// ============================================================================
// Collections (saved inspiration boards)
// ============================================================================

function rowToCollection(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    likes: p(row.likes_json, []),
    swipeProgress: p(row.swipe_progress_json, null),
    attachedToPieceId: row.attached_to_piece_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const Collections = {
  /**
   * User-visible collections only. Boards attached to a piece are owned by
   * that piece's UI and live in `Collections.getByPiece(pieceId)`.
   */
  listForUser(userId) {
    return db
      .prepare(
        `SELECT * FROM collections
         WHERE user_id = ? AND attached_to_piece_id IS NULL
         ORDER BY datetime(updated_at) DESC`,
      )
      .all(userId)
      .map(rowToCollection);
  },
  get(id) {
    return rowToCollection(
      db.prepare("SELECT * FROM collections WHERE id = ?").get(id),
    );
  },
  /** Fetch the (single) inspo collection a piece points at. */
  getByPiece(pieceId) {
    return rowToCollection(
      db
        .prepare("SELECT * FROM collections WHERE attached_to_piece_id = ?")
        .get(pieceId),
    );
  },
  insert(c) {
    db.prepare(
      `INSERT INTO collections (
        id, user_id, name, notes, likes_json, swipe_progress_json,
        attached_to_piece_id, created_at, updated_at
      ) VALUES (
        @id, @userId, @name, @notes, @likesJson, @swipeProgressJson,
        @attachedToPieceId, @createdAt, @updatedAt
      )`,
    ).run({
      id: c.id,
      userId: c.userId,
      name: c.name,
      notes: c.notes ?? null,
      likesJson: j(c.likes || []),
      swipeProgressJson: j(c.swipeProgress ?? null),
      attachedToPieceId: c.attachedToPieceId ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
    return Collections.get(c.id);
  },
  update(id, updates) {
    const existing = Collections.get(id);
    if (!existing) return null;
    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    db.prepare(
      `UPDATE collections SET
        name                 = @name,
        notes                = @notes,
        likes_json           = @likesJson,
        swipe_progress_json  = @swipeProgressJson,
        attached_to_piece_id = @attachedToPieceId,
        updated_at           = @updatedAt
       WHERE id = @id`,
    ).run({
      id,
      name: next.name,
      notes: next.notes ?? null,
      likesJson: j(next.likes || []),
      swipeProgressJson: j(next.swipeProgress ?? null),
      attachedToPieceId: next.attachedToPieceId ?? null,
      updatedAt: next.updatedAt,
    });
    return Collections.get(id);
  },
  delete(id) {
    return db.prepare("DELETE FROM collections WHERE id = ?").run(id).changes > 0;
  },
};

// ============================================================================
// Pieces (private studio log)
// ============================================================================

function rowToPiece(row) {
  if (!row) return null;
  const piece = {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    clayBody: row.clay_body,
    notes: row.notes,
    weight: row.weight ?? null,
    currentStage: row.current_stage,
    stageRecords: p(row.stage_records_json, []),
    glazes: p(row.glazes_json, []),
    inspoCollectionId: row.inspo_collection_id || null,
    publishedEntries: p(row.published_entries_json, []),
    isArchived: !!row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  // Denormalize the inspo collection's likes onto the piece so callers (the
  // piece detail page, the add-to-piece modal, the batch-add picker) don't
  // have to make a second request just to know what's already in the inspo.
  // Mutations still go through the collections API — this field is read-only.
  if (piece.inspoCollectionId) {
    const inspo = Collections.get(piece.inspoCollectionId);
    piece.inspoLikes = inspo ? inspo.likes : [];
  } else {
    piece.inspoLikes = [];
  }
  return piece;
}

export const Pieces = {
  listForUser(userId) {
    return db
      .prepare(
        "SELECT * FROM pieces WHERE user_id = ? ORDER BY datetime(updated_at) DESC",
      )
      .all(userId)
      .map(rowToPiece);
  },
  get(id) {
    return rowToPiece(db.prepare("SELECT * FROM pieces WHERE id = ?").get(id));
  },
  insert(piece) {
    db.prepare(
      `INSERT INTO pieces (
        id, user_id, name, clay_body, notes, weight, current_stage,
        stage_records_json, glazes_json, inspo_collection_id,
        published_entries_json, is_archived, created_at, updated_at
      ) VALUES (
        @id, @userId, @name, @clayBody, @notes, @weight, @currentStage,
        @stageRecordsJson, @glazesJson, @inspoCollectionId,
        @publishedEntriesJson, @isArchived, @createdAt, @updatedAt
      )`,
    ).run({
      id: piece.id,
      userId: piece.userId,
      name: piece.name,
      clayBody: piece.clayBody ?? null,
      notes: piece.notes ?? null,
      weight: piece.weight ?? null,
      currentStage: piece.currentStage,
      stageRecordsJson: j(piece.stageRecords || []),
      glazesJson: j(piece.glazes || []),
      inspoCollectionId: piece.inspoCollectionId ?? null,
      publishedEntriesJson: j(piece.publishedEntries || []),
      isArchived: piece.isArchived ? 1 : 0,
      createdAt: piece.createdAt,
      updatedAt: piece.updatedAt,
    });
    return Pieces.get(piece.id);
  },
  update(id, updates) {
    const existing = Pieces.get(id);
    if (!existing) return null;
    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    db.prepare(
      `UPDATE pieces SET
        name                   = @name,
        clay_body              = @clayBody,
        notes                  = @notes,
        weight                 = @weight,
        current_stage          = @currentStage,
        stage_records_json     = @stageRecordsJson,
        glazes_json            = @glazesJson,
        inspo_collection_id    = @inspoCollectionId,
        published_entries_json = @publishedEntriesJson,
        is_archived            = @isArchived,
        updated_at             = @updatedAt
       WHERE id = @id`,
    ).run({
      id,
      name: next.name,
      clayBody: next.clayBody ?? null,
      notes: next.notes ?? null,
      weight: next.weight ?? null,
      currentStage: next.currentStage,
      stageRecordsJson: j(next.stageRecords || []),
      glazesJson: j(next.glazes || []),
      inspoCollectionId: next.inspoCollectionId ?? null,
      publishedEntriesJson: j(next.publishedEntries || []),
      isArchived: next.isArchived ? 1 : 0,
      updatedAt: next.updatedAt,
    });
    return Pieces.get(id);
  },
  delete(id) {
    return db.prepare("DELETE FROM pieces WHERE id = ?").run(id).changes > 0;
  },
  /**
   * Create an empty inspo collection attached to `pieceId` and stamp the id
   * onto the piece row. Returns the new collection id. Runs in one txn so we
   * never end up with a piece pointing at a non-existent collection.
   */
  createInspoCollection(pieceId, userId) {
    const piece = Pieces.get(pieceId);
    if (!piece) throw new Error(`createInspoCollection: piece ${pieceId} not found`);
    if (piece.inspoCollectionId) return piece.inspoCollectionId;
    const now = new Date().toISOString();
    const id = `collection-piece-${pieceId}-${Date.now()}`;
    const make = db.transaction(() => {
      Collections.insert({
        id,
        userId,
        name: "Piece inspiration",
        notes: null,
        likes: [],
        swipeProgress: null,
        attachedToPieceId: pieceId,
        createdAt: now,
        updatedAt: now,
      });
      db.prepare("UPDATE pieces SET inspo_collection_id = ? WHERE id = ?").run(
        id,
        pieceId,
      );
    });
    make();
    return id;
  },
};

// ============================================================================
// my-glazes config (per user, fixing the previously-global bug)
// ============================================================================

const DEFAULT_MY_GLAZES = {
  version: "2.0",
  glazes: {},
  favoriteCombinations: [],
};

export const MyGlazes = {
  get(userId) {
    if (!userId) {
      return { ...DEFAULT_MY_GLAZES, lastUpdated: new Date(0).toISOString() };
    }
    const row = db
      .prepare("SELECT config_json, updated_at FROM my_glazes WHERE user_id = ?")
      .get(userId);
    if (!row) {
      return { ...DEFAULT_MY_GLAZES, lastUpdated: new Date(0).toISOString() };
    }
    const config = p(row.config_json, { ...DEFAULT_MY_GLAZES });
    return { ...config, lastUpdated: row.updated_at };
  },
  save(userId, config) {
    if (!userId) throw new Error("MyGlazes.save: userId is required");
    const now = new Date().toISOString();
    const cleaned = { ...config };
    delete cleaned.lastUpdated;
    db.prepare(
      `INSERT INTO my_glazes (user_id, config_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         config_json = excluded.config_json,
         updated_at  = excluded.updated_at`,
    ).run(userId, j(cleaned), now);
    return { ...cleaned, lastUpdated: now };
  },
};

// ============================================================================
// Shared studio inventory
// ----------------------------------------------------------------------------
// One singleton row (`id = 1`). Owned-glaze IDs are a fact about the physical
// studio, not about any individual user — so this table is publicly readable
// (signed-out visitors see real ownership state) and writeable only by users
// with `role = "admin"`. Personal taste (favorites) stays in `my_glazes`.
// ============================================================================

export const Inventory = {
  get() {
    const row = db
      .prepare(
        "SELECT owned_glaze_ids_json, updated_at, updated_by FROM inventory WHERE id = 1",
      )
      .get();
    if (!row) {
      return {
        ownedGlazeIds: [],
        updatedAt: new Date(0).toISOString(),
        updatedBy: null,
      };
    }
    return {
      ownedGlazeIds: p(row.owned_glaze_ids_json, []),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  },
  save(ownedGlazeIds, updatedBy) {
    if (!Array.isArray(ownedGlazeIds)) {
      throw new Error("Inventory.save: ownedGlazeIds must be an array");
    }
    // Dedup + sort so two admins editing in rapid succession don't fight
    // over insignificant ordering differences in the JSON column.
    const cleaned = Array.from(new Set(ownedGlazeIds.filter((id) => typeof id === "string"))).sort();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO inventory (id, owned_glaze_ids_json, updated_at, updated_by)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         owned_glaze_ids_json = excluded.owned_glaze_ids_json,
         updated_at           = excluded.updated_at,
         updated_by           = excluded.updated_by`,
    ).run(j(cleaned), now, updatedBy ?? null);
    return { ownedGlazeIds: cleaned, updatedAt: now, updatedBy: updatedBy ?? null };
  },
  /**
   * One-shot migration: walk every row in `my_glazes` and union every glaze
   * any user marked as owned into the shared inventory. Idempotent via the
   * schema_migrations table — re-running is a no-op. Run at server startup.
   *
   * After this seed, individual users' `owned` flags in `my_glazes` are no
   * longer the source of truth; the client stops writing them and they'll
   * naturally drift out of the picture. We don't delete them here in case
   * we ever need to recover the per-user history.
   */
  seedFromMyGlazes() {
    const NAME = "2026-06-inventory-from-my-glazes";
    if (Migrations.hasRun(NAME)) return;
    const union = new Set();
    for (const row of db.prepare("SELECT config_json FROM my_glazes").all()) {
      const config = p(row.config_json, {});
      const glazes = config && typeof config.glazes === "object" ? config.glazes : {};
      for (const [glazeId, entry] of Object.entries(glazes)) {
        if (entry && entry.owned) union.add(glazeId);
      }
    }
    Inventory.save(Array.from(union), null);
    Migrations.markRun(NAME);
    console.log(
      `Seeded shared inventory with ${union.size} glazes from existing my_glazes rows.`,
    );
  },
};

// ============================================================================
// Resource members (gated editing)
// ----------------------------------------------------------------------------
// Holds *added* collaborators for pieces and collections. The owner stays on
// the resource's existing `user_id` column so the hot read path (e.g.
// `SELECT * FROM pieces WHERE user_id = ?`) is unchanged; this table is the
// extension point for the eventual share UX (add editors, transfer owner).
//
// Today there are no API endpoints that write to this table — it exists so
// authorization can already consult it (`require: 'editor'` in
// `loadAndAuthorize`) and so deletes cascade cleanly when the share sheet
// lands. The schema's role column has no CHECK constraint by design: enums
// elsewhere in the schema (e.g. `pieces.current_stage`) are validated in
// code rather than in DDL so we don't need a destructive table rebuild to
// add new roles. `add()` is the gatekeeper.
// ============================================================================

export const ResourceMembers = {
  getRole(resourceType, resourceId, userId) {
    if (!resourceType || !resourceId || !userId) return null;
    const row = db
      .prepare(
        `SELECT role FROM resource_members
         WHERE resource_type = ? AND resource_id = ? AND user_id = ?`,
      )
      .get(resourceType, resourceId, userId);
    return row ? row.role : null;
  },
  list(resourceType, resourceId) {
    return db
      .prepare(
        `SELECT user_id, role, added_by, added_at FROM resource_members
         WHERE resource_type = ? AND resource_id = ?
         ORDER BY datetime(added_at) ASC`,
      )
      .all(resourceType, resourceId)
      .map((r) => ({
        userId: r.user_id,
        role: r.role,
        addedBy: r.added_by,
        addedAt: r.added_at,
      }));
  },
  add(resourceType, resourceId, userId, role, addedBy) {
    if (!["piece", "collection"].includes(resourceType)) {
      throw new Error(`ResourceMembers.add: invalid resourceType ${resourceType}`);
    }
    // Today only 'editor' rows are written. 'owner' is reserved for a future
    // transfer-ownership flow and should be accepted by the schema (no CHECK
    // constraint) but rejected here until that flow ships and an explicit
    // helper (e.g. `transferOwner`) takes responsibility for the invariants.
    if (role !== "editor") {
      throw new Error(`ResourceMembers.add: invalid role ${role}`);
    }
    db.prepare(
      `INSERT OR IGNORE INTO resource_members
         (resource_type, resource_id, user_id, role, added_by, added_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(resourceType, resourceId, userId, role, addedBy, new Date().toISOString());
    return ResourceMembers.getRole(resourceType, resourceId, userId);
  },
  remove(resourceType, resourceId, userId) {
    return (
      db
        .prepare(
          `DELETE FROM resource_members
           WHERE resource_type = ? AND resource_id = ? AND user_id = ?`,
        )
        .run(resourceType, resourceId, userId).changes > 0
    );
  },
  removeAllFor(resourceType, resourceId) {
    db.prepare(
      `DELETE FROM resource_members WHERE resource_type = ? AND resource_id = ?`,
    ).run(resourceType, resourceId);
  },
  removeAllForUser(userId) {
    db.prepare(`DELETE FROM resource_members WHERE user_id = ?`).run(userId);
  },
};

// ============================================================================
// Schema migrations bookkeeping
// ============================================================================

export const Migrations = {
  hasRun(name) {
    return !!db
      .prepare("SELECT 1 FROM schema_migrations WHERE name = ?")
      .get(name);
  },
  markRun(name) {
    db.prepare(
      "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
    ).run(name, new Date().toISOString());
  },
  /**
   * Add the `weight` column to existing `pieces` tables that predate the
   * feature. New databases get the column from the CREATE TABLE in db.js
   * and skip this. Idempotent.
   */
  addPieceWeightColumn() {
    const NAME = "2026-06-piece-weight";
    if (Migrations.hasRun(NAME)) return;
    const hasColumn = db
      .prepare("PRAGMA table_info(pieces)")
      .all()
      .some((c) => c.name === "weight");
    if (!hasColumn) {
      db.exec("ALTER TABLE pieces ADD COLUMN weight TEXT");
    }
    Migrations.markRun(NAME);
  },
  /**
   * Backend prep for gated editing: create the `resource_members` table that
   * will hold added editors for pieces and collections. Owner continues to
   * live on the resource's `user_id`; this table is the extension point.
   *
   * v2: dropped the role CHECK (kept in code so we can add 'owner' for
   * transfer-of-ownership without a destructive rebuild) and removed the
   * redundant `_resource_idx` (the PK index already covers that prefix).
   * Safe to drop+recreate because no endpoint writes to this table yet.
   */
  addResourceMembersTable() {
    const NAME = "2026-06-resource-members-v2";
    if (Migrations.hasRun(NAME)) return;
    db.exec(`
      DROP TABLE IF EXISTS resource_members;
      CREATE TABLE resource_members (
        resource_type TEXT NOT NULL CHECK (resource_type IN ('piece','collection')),
        resource_id   TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        role          TEXT NOT NULL,
        added_by      TEXT NOT NULL,
        added_at      TEXT NOT NULL,
        PRIMARY KEY (resource_type, resource_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS resource_members_user_idx
        ON resource_members(user_id, resource_type);
    `);
    Migrations.markRun(NAME);
  },
};

// ============================================================================
// Account-level cascade
// ============================================================================

/**
 * Nuke every SQLite row owned by `userId` and return the list of image URLs
 * that belonged to them, so the caller can delete the matching blobs/files.
 *
 * Done inside a single transaction so we never end up half-deleted. Photo
 * blobs are deleted by the caller (`routes/auth.js`, `routes/admin.js`) using
 * `deleteImage` — that's an async operation against blob storage and doesn't
 * belong inside the SQLite transaction.
 */
export const UserData = {
  collectPhotoUrls(userId) {
    const photos = [];
    for (const upload of db
      .prepare("SELECT image_urls_json FROM uploads WHERE user_id = ?")
      .all(userId)) {
      for (const url of p(upload.image_urls_json, [])) photos.push(url);
    }
    for (const piece of db
      .prepare("SELECT stage_records_json FROM pieces WHERE user_id = ?")
      .all(userId)) {
      for (const rec of p(piece.stage_records_json, [])) {
        for (const url of rec.photos || []) photos.push(url);
      }
    }
    return photos;
  },

  /**
   * Returns `{ photoUrls }` — every image URL the deleted user owned, in the
   * order the caller should attempt to delete them. SQLite rows are gone by
   * the time this returns.
   */
  purge(userId) {
    if (!userId) throw new Error("UserData.purge: userId is required");
    const photoUrls = UserData.collectPhotoUrls(userId);
    const purgeTx = db.transaction((uid) => {
      // Clear member rows for the resources we're about to delete BEFORE the
      // resources go away (the IN subqueries need them to still exist).
      // This handles the "someone else was an editor on my piece" case; the
      // `WHERE user_id = ?` delete below covers the inverse.
      db.prepare(
        `DELETE FROM resource_members
         WHERE resource_type = 'piece'
           AND resource_id IN (SELECT id FROM pieces WHERE user_id = ?)`,
      ).run(uid);
      db.prepare(
        `DELETE FROM resource_members
         WHERE resource_type = 'collection'
           AND resource_id IN (SELECT id FROM collections WHERE user_id = ?)`,
      ).run(uid);
      db.prepare("DELETE FROM uploads          WHERE user_id = ?").run(uid);
      db.prepare("DELETE FROM collections      WHERE user_id = ?").run(uid);
      db.prepare("DELETE FROM pieces           WHERE user_id = ?").run(uid);
      db.prepare("DELETE FROM my_glazes        WHERE user_id = ?").run(uid);
      db.prepare("DELETE FROM resource_members WHERE user_id = ?").run(uid);
    });
    purgeTx(userId);
    return { photoUrls };
  },
};
