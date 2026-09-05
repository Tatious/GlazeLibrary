/**
 * Shared rate-limit configurations for sensitive endpoints.
 *
 * Use `authLimiter` for signup / self-delete / admin mutations — anything
 * that hits Firebase Admin or creates state on behalf of a user. We're not
 * trying to rate-limit ordinary reads or repository mutations (the latter
 * are already guarded by Firebase token verification).
 */

import rateLimit from "express-rate-limit";

const FIFTEEN_MIN = 15 * 60 * 1000;

/**
 * 10 requests / 15 min / IP. Suitable for signup and self-delete-account.
 * Pre-flight CORS (OPTIONS) requests are skipped.
 */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a few minutes." },
});

/**
 * 30 requests / 15 min / IP. Suitable for admin write endpoints (invite-code
 * issue/revoke, role updates, user delete). Slightly higher than auth because
 * an admin batching invite codes shouldn't get throttled.
 */
export const adminLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a few minutes." },
});
