/**
 * SQLite database — single file at `DB_PATH`.
 *
 * The DB lives at:
 *   - Azure App Service: `/home/data/glaze.db` (persisted across restarts)
 *   - Local dev:        `server/data/glaze.db`
 *
 * Schema is initialized eagerly on import and is idempotent (`CREATE ... IF
 * NOT EXISTS`). Migrations from the legacy JSON files happen once, in
 * `migrateJsonToSqlite()`, on server boot.
 *
 * Why SQLite:
 *   - real transactions (publish-from-piece is one atomic step)
 *   - per-user queries don't scan a whole-app JSON blob
 *   - my-glazes is finally keyed on user_id (fixes the global-config bug)
 *   - no extra Azure resource — single file backed up to Blob nightly
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pick a writable directory: Azure persists `/home`; locally we use `server/data`.
const isAzure = !!process.env.WEBSITE_INSTANCE_ID;
const DEFAULT_DIR = isAzure
  ? "/home/data"
  : path.join(__dirname, "..", "data");
const DB_PATH = process.env.GLAZE_DB_PATH || path.join(DEFAULT_DIR, "glaze.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

console.log(`SQLite database: ${DB_PATH}`);

// ============================================================================
// Schema
// ============================================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL,
    combination_id  TEXT    NOT NULL,
    is_single_glaze INTEGER NOT NULL DEFAULT 0,
    top_glaze_id    TEXT,
    bottom_glaze_id TEXT,
    top_coats       INTEGER NOT NULL DEFAULT 2,
    bottom_coats    INTEGER NOT NULL DEFAULT 2,
    cone            TEXT,
    clay_body       TEXT,
    notes           TEXT,
    tags_json       TEXT    NOT NULL DEFAULT '[]',
    image_urls_json TEXT    NOT NULL DEFAULT '[]',
    created_at      TEXT    NOT NULL,
    updated_at      TEXT
  );
  CREATE INDEX IF NOT EXISTS uploads_user_idx ON uploads(user_id);
  CREATE INDEX IF NOT EXISTS uploads_combination_idx ON uploads(combination_id);
  CREATE INDEX IF NOT EXISTS uploads_top_glaze_idx ON uploads(top_glaze_id);

  CREATE TABLE IF NOT EXISTS collections (
    id                   TEXT    PRIMARY KEY,
    user_id              TEXT    NOT NULL,
    name                 TEXT    NOT NULL,
    notes                TEXT,
    likes_json           TEXT    NOT NULL DEFAULT '[]',
    swipe_progress_json  TEXT,
    -- Non-null when this collection is the inspo board owned by a piece;
    -- such collections are hidden from the standalone Collections list and
    -- cascade-deleted with the piece. See repositories.js.
    attached_to_piece_id TEXT,
    created_at           TEXT    NOT NULL,
    updated_at           TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS collections_user_idx ON collections(user_id);
  CREATE INDEX IF NOT EXISTS collections_attached_idx
    ON collections(attached_to_piece_id);

  CREATE TABLE IF NOT EXISTS pieces (
    id                    TEXT    PRIMARY KEY,
    user_id               TEXT    NOT NULL,
    name                  TEXT    NOT NULL,
    clay_body             TEXT,
    notes                 TEXT,
    -- Original (pre-firing) weight as the user typed it, e.g. "250g" or
    -- "8 oz". Free-form text so we don't pick a unit for the user.
    weight                TEXT,
    current_stage         TEXT    NOT NULL DEFAULT 'greenware',
    stage_records_json    TEXT    NOT NULL DEFAULT '[]',
    glazes_json           TEXT    NOT NULL DEFAULT '[]',
    -- Eagerly created on piece insert. Always non-null after the startup
    -- backfill in repositories.js runs.
    inspo_collection_id   TEXT,
    published_entries_json TEXT   NOT NULL DEFAULT '[]',
    is_archived           INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS pieces_user_idx ON pieces(user_id);

  -- One row per user — keys the previously-global my-glazes config to user_id.
  CREATE TABLE IF NOT EXISTS my_glazes (
    user_id       TEXT    PRIMARY KEY,
    config_json   TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
  );

  -- Shared studio inventory. Ownership is a fact about the physical studio,
  -- not about any individual user, so it lives in a single shared row that
  -- everyone reads (including signed-out visitors); only admins write.
  -- Personal taste (favorites) still lives in the my_glazes table above.
  CREATE TABLE IF NOT EXISTS inventory (
    id                    INTEGER PRIMARY KEY CHECK (id = 1),
    owned_glaze_ids_json  TEXT    NOT NULL DEFAULT '[]',
    updated_at            TEXT    NOT NULL,
    updated_by            TEXT
  );

  -- Tracks one-shot startup migrations so they don't re-run.
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT    PRIMARY KEY,
    applied_at TEXT    NOT NULL
  );
`);

export default db;
export { DB_PATH };
