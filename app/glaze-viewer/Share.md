# Sharing & collaboration spec

> **Status (2026-06-10):** revised down from the original invite/email design to
> match the intended UX — **"just a share link to copy, and a people picker to
> add."** The studio is small and trusted, so collaborators are added *directly*
> by **username**; there are no email invites, no invite tokens, and no
> acceptance flow. The assessment below reflects what the current codebase
> actually supports (Firebase Auth + Firestore `profiles`, SQLite content,
> `loadAndAuthorize` ownership gate) and flags the one real prerequisite:
> **the app has no `username` concept yet** (§ "Username prerequisite"). Not yet
> implemented — captured here to revisit.

## Goals

1. **Public read links** — anyone with the URL can view a piece or collection (signed in or not). One click to toggle, one click to copy.
2. **Direct collaboration** — owner adds a studio member by **username** from a people picker; the member is added immediately (no invite to accept). Members can edit but can't manage members or delete the resource.
3. **Owner controls** — single owner per resource, can add/remove members and toggle the public link.
4. **Distinct "remove" vs "delete"** — owner deletes (destroys for everyone); member leaves (removes self only).

## Non-goals (v1)

- **Email invites / invite tokens / acceptance flow** — dropped. Members are added directly by username. (Was the bulk of the original spec.)
- **Transfer ownership** — deferred to a later phase.
- Per-field permissions (e.g. "can edit notes but not glazes").
- Comments / activity feed.
- Role hierarchy beyond owner / member.
- Notifications outside the app.
- Self-service "request access" from a public link.

## Username prerequisite (new work, gates the people picker)

The people picker resolves a typed **username → uid**. The app does **not** have
usernames today:

- Identity is Firebase Auth `email` + `displayName`.
- `profiles/{uid}` in Firestore holds `{ id, display_name, role, created_at, updated_at }` — see `server/routes/auth.js` signup. `display_name` is **free-form and non-unique**, so it can't be the lookup key.
- Firebase Admin exposes `getUserByEmail()` but **no** `getUserByUsername()`.

So Phase 2 must first add a unique username:

1. Add a `username` field to `profiles` (lowercased, validated `^[a-z0-9_]{3,20}$`).
2. Enforce uniqueness with a Firestore index doc: `usernames/{username} → { uid }`, written transactionally at signup. (Firestore has no unique constraint; the index doc *is* the constraint.)
3. Collect username at signup (`server/routes/auth.js`) and backfill existing users (one-off script; e.g. seed from `display_name` slug + dedupe suffix).
4. Add a lookup endpoint `GET /api/users/by-username/:username → { userId, displayName }` (owner-gated, rate-limited) used by the picker.

If introducing usernames is too heavy, the fallback is **add-by-email** using the
existing `getUserByEmail()` — no schema change, but the owner must know the
member's email. Username is preferred for the studio; treat email as the
fallback path.

## Data model

One new table, one new column per shareable resource. **No `resource_invites`
table** (invites were dropped).

```sql
-- One row per (resource, member). Owner is NOT a row here — ownership
-- stays on the resource's existing user_id column to keep the hot read
-- path (`SELECT * FROM pieces WHERE user_id = ?`) unchanged.
CREATE TABLE resource_members (
  resource_type  TEXT    NOT NULL CHECK (resource_type IN ('piece','collection')),
  resource_id    TEXT    NOT NULL,
  user_id        TEXT    NOT NULL,
  role           TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  added_by       TEXT    NOT NULL,
  added_at       TEXT    NOT NULL,
  PRIMARY KEY (resource_type, resource_id, user_id)
);
CREATE INDEX resource_members_user_idx ON resource_members(user_id, resource_type);
```

Add to `pieces` and `collections`:

```sql
ALTER TABLE pieces      ADD COLUMN public_share_token TEXT;  -- null = not publicly shared
ALTER TABLE collections ADD COLUMN public_share_token TEXT;
CREATE UNIQUE INDEX pieces_share_token_idx       ON pieces(public_share_token)      WHERE public_share_token IS NOT NULL;
CREATE UNIQUE INDEX collections_share_token_idx  ON collections(public_share_token) WHERE public_share_token IS NOT NULL;
```

These match the existing `server/lib/db.js` conventions: snake_case columns,
`TEXT` ISO timestamps, partial unique indexes (cf. the existing
`*_share_token`-style partial indexes). `user_id` / `added_by` store Firebase
uids, consistent with every other table.

## Authorization model

Replace `loadAndAuthorize`'s single "userId === uid" check (`server/middleware/loadAndAuthorize.js`) with a tiered ladder. New shape:

```js
loadAndAuthorize(repo, paramName, {
  resourceType: 'piece' | 'collection',
  require: 'owner' | 'member' | 'reader',
})
```

Levels:

- **reader** — owner OR member OR (resource has `public_share_token` AND request has matching `?share=<token>`). Sets `req.access = 'reader'` for the token/anon case.
- **member** — owner OR row in `resource_members`. Sets `req.access` to `'owner' | 'member'`.
- **owner** — resource's `userId === req.uid`. Sets `req.access = 'owner'`.

All three set `req.access` to the *highest* tier the caller actually holds, so an
owner hitting a `reader` route still gets `req.access = 'owner'`.

Public GETs (with token) must skip the mandatory `verifyUser`. Add an
**`optionalVerifyUser`** middleware to `server/middleware/auth.js`: it populates
`req.uid` from a Bearer token if present, sets `req.uid = null` otherwise, and
never 401s. Token-aware GETs use `optionalVerifyUser`; everything else keeps the
mandatory `verifyUser`.

**Inspo collections** (`attached_to_piece_id != null`) are never independently
shareable: when `loadAndAuthorize` sees one, it resolves access against the
**parent piece** instead, and the share/member endpoints reject them outright.

## API surface

Per-resource routes under the existing `/api/pieces/:id` and `/api/collections/:id`,
matching the current nested-route style (e.g. `/:id/photo`). To avoid duplicating
~150 lines across the two resources, factor the handler bodies into
`server/lib/shareHandlers.js` and mount thin wrappers in each router.

**Read (now token-aware, via `optionalVerifyUser`):**

- `GET /api/pieces/:id` — anonymous OK if `?share=<token>` matches. Returns the resource plus a new `viewerAccess: 'owner'|'member'|'reader'` field so the client can render edit UI conditionally.
- `GET /api/collections/:id` — same (rejects inspo collections; access them via the piece).

**Existing mutations (now `require: 'member'` so members can edit):**

- `PUT /api/pieces/:id`, `POST /api/pieces/:id/photo`, `DELETE /api/pieces/:id/photo`, and the collection equivalents.
- `DELETE /api/pieces/:id` and `DELETE /api/collections/:id` stay **`require: 'owner'`**.

**New endpoints:**

| Method | Path | Who | Body / params |
|---|---|---|---|
| POST | `/api/pieces/:id/share/public` | owner | `{ enabled: true }` → mints + returns `{ token, url }`. `{ enabled: false }` → clears it. |
| GET | `/api/pieces/:id/members` | member | list `[{ userId, displayName, username, role, addedAt, isOwner }]` (display fields fetched live + batched from Firebase/Firestore) |
| POST | `/api/pieces/:id/members` | owner | `{ username }` → resolves username→uid, inserts a `resource_members` row immediately, returns the new member. Errors: `404` no such username, `409` already a member / is owner. |
| DELETE | `/api/pieces/:id/members/:userId` | owner (any member) OR self (only own row) | remove member / leave |
| DELETE | `/api/pieces/:id` | **owner only** | unchanged behavior + cascade member rows |
| GET | `/api/p/:token` | anyone | resolves a public token → `{ resourceType, resource, viewerAccess: 'reader' }`. New top-level router `server/routes/public-share.js`. |

Same shape repeated for collections (inspo collections rejected on every share/member route).

**Dropped from the original spec:** `POST .../invites`, `GET .../invites`,
`DELETE .../invites/:token`, `POST /api/invites/:token/accept`, and
`POST .../transfer-owner` (transfer deferred).

## Client flow

**Share sheet** — single component (`src/components/ShareSheet.tsx`) reused on
both detail pages, built on the existing `Modal.tsx` + `ConfirmAction.tsx`
primitives:

```
Share Big Mug                                              ×
─────────────────────────────────────────────────────────────
🌐  Anyone with the link can view                  [ Off ●○ ]
    ↳ when on:
    https://glaze.app/p/abc...                    [ Copy ]

👥  People with access
    AUSTIN  Austin (you)                          Owner
    SARAH   @sarah_k                              Editor   ✕ Remove

➕  Add a person
    [ @username                    ]    [ Add ]
    ↳ inline error: "No studio member with that username."
```

**On the detail page:**

- New share icon next to the existing pencil. Tap → opens the sheet.
- Gating is driven by the server-provided `viewerAccess` (replacing today's client-derived `isOwner`):
  - `reader` (public link): hide all edit affordances (no pencil, no Add chips, no delete X, no share button). Show a small read-only banner.
  - `member`: full edit UI **except** the Actions card shows **"Leave piece"** instead of "Archive / Delete".
  - `owner`: unchanged; share sheet shows the public toggle + people picker.

**Adding a person:** owner types a username → `POST /api/pieces/:id/members { username }`.
On success the member appears in the list and the resource shows up in *their*
"shared with me" list immediately — no acceptance step. Adding by username
reveals whether that username exists; the endpoint is owner-only and
rate-limited to mitigate enumeration.

**Cascade rules:**

- Owner deletes resource → explicit `DELETE FROM resource_members` for that resource (mirrors the existing inspo-collection cascade in `server/routes/pieces.js`; `foreign_keys = ON` is set but the codebase prefers explicit deletes). Deleting a piece also cascades its inspo collection's member rows.
- Member leaves → just removes their own `resource_members` row; resource untouched.
- User deletes account → extend `UserData.purge()` (`server/lib/repositories.js`) to also `DELETE FROM resource_members WHERE user_id = ?`. Resources they owned are already destroyed by the existing cascade (which now also clears those resources' member rows).

## URL strategy

- **Owner / member URL:** `https://glaze.app/pieces/abc123` — auth required, same as today.
- **Public read URL:** `https://glaze.app/p/<token>` — short prefix, no internal id. The client route `/p/:token` calls `GET /api/p/:token`, then renders the **existing** detail components in reader mode (no duplicate public pages). Keeping a separate path makes shared links obvious in logs and lets the owner revoke without invalidating the canonical URL for members.

## Migration

Single idempotent startup migration in `Migrations` (`server/lib/repositories.js`),
called from `startServer()` in `server/index.js` alongside the existing
migrations. Token generation uses `randomBytes` from `node:crypto` — note the
codebase is **ESM**, so import at module top (`import { randomBytes } from "crypto"`),
never `require()`:

```js
addSharingTables() {
  const NAME = "2026-06-sharing-v1";
  if (Migrations.hasRun(NAME)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS resource_members ( ... );      -- members only; no invites
    CREATE INDEX IF NOT EXISTS resource_members_user_idx ...;
  `);
  // Both ALTERs guarded by PRAGMA table_info check
  for (const t of ['pieces', 'collections']) {
    const has = db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === 'public_share_token');
    if (!has) db.exec(`ALTER TABLE ${t} ADD COLUMN public_share_token TEXT`);
  }
  // Partial unique indexes
  db.exec(`...`);
  Migrations.markRun(NAME);
}
```

Public tokens: `randomBytes(32).toString('hex')` (256-bit, 64 hex chars).

## Edge cases / open questions

1. **Inspo collections owned by pieces** — never independently shareable. When access is computed on an `attached_to_piece_id != null` collection, defer entirely to the parent piece's access; share/member endpoints reject them. They never get their own `public_share_token` or member rows.
2. **"Published Result" on a shared piece** — unchanged. Published combos are already public on the combo page; the piece's `publishedEntries` list is part of the piece so members see it, but the published entries remain owned by whoever published them.
3. **Username lookup (Firestore vs SQLite)** — auth/profiles are Firebase, content is SQLite. The picker needs username→uid. This requires the new `usernames/{username} → uid` index doc (§ "Username prerequisite"). Resolution happens in the owner-only `POST .../members` handler. Fallback path: `getUserByEmail()` if usernames aren't introduced.
4. **Member display data** — `resource_members` stores only `user_id`. The `GET .../members` endpoint hydrates `displayName` / `username` live from Firebase/Firestore, **batched** per request, so profile edits never go stale. (Alternative: snapshot into the row — rejected for staleness.)
5. **Direct-add consent** — adding by username grants access without the member opting in. Acceptable for a trusted studio and matches the desired UX. Mitigations: owner-only endpoint + rate-limit the username lookup / add to prevent enumeration; cap members per resource (e.g. 50).
6. **Rate-limiting / abuse** — public links are guessable vectors. Tokens are ≥256-bit. Add a `shareLimiter` (e.g. 60/15min/IP) to `server/middleware/rate-limit.js` for `GET /api/p/:token`; reuse `authLimiter` on `POST .../members` and the username lookup.
7. **Shared-with-me lists (now core)** — since there's no invite/notification, the *only* in-app way an added member finds the resource is their list. Extend `Pieces.listForUser` / `Collections.listForUser` (or add `listForUserIncludingShared`) to UNION `WHERE user_id = ?` with `WHERE id IN (SELECT resource_id FROM resource_members WHERE user_id = ? AND resource_type = ...)`. Render a "Shared by Austin" sub-line on those cards. Collections must keep the `attached_to_piece_id IS NULL` guard so inspo boards don't leak in.

## Build phases

**Phase 1 — copy-link public reads (small, ships standalone)**

- `public_share_token` columns + `addSharingTables()` migration
- `POST /api/pieces/:id/share/public` toggle + `GET /api/p/:token` resolver
- `optionalVerifyUser`; token-aware `GET /api/pieces/:id` & `/collections/:id` returning `viewerAccess`
- `/p/:token` client route reusing detail components in reader mode
- Share sheet with public toggle + copy
- Client edit-UI gating from `viewerAccess`

**Phase 2 — people picker (direct add by username)**

- **Username prerequisite first:** `username` on profiles + `usernames/{username}` index + signup capture + backfill + `GET /api/users/by-username/:username`
- `resource_members` table (in the same migration)
- Auth ladder: extend `loadAndAuthorize` with `require` + inspo deferral
- `GET /api/pieces/:id/members`, `POST .../members` (by username), `DELETE .../members/:userId`
- Existing mutations move to `require: 'member'`
- Share sheet member list + add-by-username picker
- "Leave piece" / "Leave collection" replacing delete for members
- Cascades: resource delete + `UserData.purge()`
- Lists include shared-with-me ("Shared by …")

**Phase 3 — polish (deferred)**

- Transfer ownership
- Activity / "Austin added a photo" timeline entries (optional)

**v1 cut line:** ship Phase 1 alone first (no collaboration), then Phase 2 once
usernames land. Transfer-ownership and activity feed stay out until the data
model proves out.

