/**
 * Firestore document types.
 *
 * Profiles + invite codes live in Firestore (Spark tier); every other domain
 * entity is in SQLite — see `server/lib/db.js`. Shapes match the docs as
 * written by `server/routes/admin.js` and `server/routes/auth.js`.
 */

export interface Profile {
  id: string;
  display_name: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}
