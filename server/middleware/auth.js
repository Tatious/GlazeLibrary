/**
 * Authentication / authorization middleware.
 *
 * - `verifyAdmin`         — requires a Firebase ID token whose profile has role="admin".
 * - `verifyUser`          — requires a valid Firebase ID token; attaches `req.uid`.
 * - `optionalVerifyUser`  — populates `req.uid` if a token is present, else null; never 401s.
 *
 * Both rely on Firebase Admin SDK and the `profiles` Firestore collection,
 * which we keep on the free Spark tier (Auth + minimal profile docs only).
 */

import { adminAuth, adminDb } from "../lib/firebase-admin.js";

export async function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!adminAuth || !adminDb) {
    return res.status(500).json({ error: "Server not configured" });
  }
  const idToken = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const profileSnap = await adminDb
      .collection("profiles")
      .doc(decoded.uid)
      .get();
    if (!profileSnap.exists || profileSnap.data().role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function verifyUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!adminAuth) {
    return res.status(500).json({ error: "Server not configured" });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    req.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Like `verifyUser` but never short-circuits. Sets `req.uid` to the verified
 * uid if a valid Bearer token is present, otherwise `req.uid = null`. Used on
 * routes that are open to anonymous readers but want to recognize signed-in
 * callers (e.g. to compute their access tier for the response payload).
 */
export async function optionalVerifyUser(req, res, next) {
  req.uid = null;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ") || !adminAuth) {
    return next();
  }
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    req.uid = decoded.uid;
  } catch {
    // Invalid / expired token — treat as anonymous; don't 401.
  }
  next();
}
