/**
 * Firebase Admin SDK initialization.
 *
 * Reads service account from either:
 *  - server/firebase-service-account.json (local dev)
 *  - FIREBASE_SERVICE_ACCOUNT env var (production)
 *
 * Exports `adminDb` and `adminAuth`. Both are `null` if init fails so callers
 * can guard with `if (!adminDb) return res.status(500)...`.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let adminDb = null;
let adminAuth = null;

try {
  const serviceAccountPath = path.join(__dirname, "..", "firebase-service-account.json");
  let serviceAccount;
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    throw new Error("No Firebase service account found");
  }
  initializeApp({ credential: cert(serviceAccount) });
  adminDb = getFirestore();
  adminAuth = getAuth();
  console.log("Firebase Admin SDK initialized");
} catch (err) {
  console.error("Firebase Admin SDK init failed:", err.message);
}

export { adminDb, adminAuth };
