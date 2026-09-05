/**
 * Tiny JSON helpers shared by routes and repositories.
 *
 * Both `parseJsonOrDefault` and `stringifyOrNull` previously lived inline in
 * multiple files (uploads.js: `parseJson`, repositories.js: `p`/`j`). Keep
 * them here so the behavior (silent fallback, null-for-null) is identical
 * everywhere.
 */

/**
 * Parse `raw` as JSON. Returns `fallback` on null/undefined input or any
 * parse error — never throws.
 */
export function parseJsonOrDefault(raw, fallback) {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Stringify `value`, but pass `null`/`undefined` straight through so SQLite
 * stores a real NULL instead of the string "null". Use this for columns that
 * are TEXT with explicit nullability.
 */
export function stringifyOrNull(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}
