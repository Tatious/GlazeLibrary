/**
 * Turn Firebase auth errors (and our server's auth errors) into copy users
 * can actually read. Anything we don't recognize falls back to a generic
 * "something went wrong" rather than leaking `Firebase: Error (auth/...)`.
 *
 * Login deliberately collapses "wrong password" and "user not found" into
 * one message — modern Firebase already does this server-side with
 * `auth/invalid-credential`, but we keep the legacy codes mapped to the
 * same string for older SDK behavior and so we don't enumerate accounts.
 */

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/invalid-login-credentials": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password is too weak — use at least 6 characters.",
  "auth/missing-password": "Please enter a password.",
  "auth/too-many-requests":
    "Too many attempts. Wait a few minutes before trying again.",
  "auth/network-request-failed":
    "Network error — check your connection and try again.",
  "auth/requires-recent-login":
    "For security, please sign in again before making this change.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled.",
  "auth/popup-closed-by-user": "Sign-in window closed before finishing.",
  "auth/user-token-expired": "Your session expired. Please sign in again.",
  "auth/user-mismatch":
    "The credentials you entered don't match the signed-in account.",
};

function extractCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  // Some errors only expose the code inside the message string.
  if (err instanceof Error) {
    const match = err.message.match(/\(auth\/[a-z-]+\)/);
    if (match) return match[0].slice(1, -1);
  }
  return null;
}

export function formatAuthError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const code = extractCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  // Trust server-side error strings we control (no `auth/` prefix and short
  // enough to be a real sentence, not a stack trace fragment).
  if (err instanceof Error && err.message && !err.message.includes("Firebase") && err.message.length < 200) {
    return err.message;
  }
  return fallback;
}
