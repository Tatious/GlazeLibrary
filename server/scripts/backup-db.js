#!/usr/bin/env node
/**
 * Nightly SQLite \u2192 Azure Blob backup.
 *
 * Run from a cron job, Azure WebJob, or anything else that fires daily:
 *   node server/scripts/backup-db.js
 *
 * Behavior:
 *   - Reads the live DB path (env GLAZE_DB_PATH, or the default in lib/db.js).
 *   - Uses SQLite's online `VACUUM INTO` so the snapshot is internally
 *     consistent even while the server is serving traffic.
 *   - Uploads to `backups/glaze-YYYY-MM-DD.db` in the same blob container we
 *     already use for images + JSON data.
 *
 * Cost: a single ~few-MB blob per day. Negligible.
 *
 * Skips silently in local dev if AZURE_STORAGE_CONNECTION_STRING is unset.
 */

import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connectionString) {
  console.log("AZURE_STORAGE_CONNECTION_STRING not set \u2014 skipping backup.");
  process.exit(0);
}

const isAzure = !!process.env.WEBSITE_INSTANCE_ID;
const DEFAULT_DIR = isAzure ? "/home/data" : path.resolve("server/data");
const DB_PATH = process.env.GLAZE_DB_PATH || path.join(DEFAULT_DIR, "glaze.db");

if (!fs.existsSync(DB_PATH)) {
  console.error(`No DB found at ${DB_PATH}`);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const tmpFile = path.join(os.tmpdir(), `glaze-${date}.db`);

console.log(`Snapshotting ${DB_PATH} \u2192 ${tmpFile}`);
const db = new Database(DB_PATH, { readonly: true });
try {
  // VACUUM INTO is the safest online backup primitive SQLite ships.
  db.exec(`VACUUM INTO '${tmpFile.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

const { BlobServiceClient } = await import("@azure/storage-blob");
const containerName = process.env.AZURE_STORAGE_CONTAINER || "glaze-data";
const blobName = `backups/glaze-${date}.db`;

const client = BlobServiceClient.fromConnectionString(connectionString)
  .getContainerClient(containerName)
  .getBlockBlobClient(blobName);

const stat = fs.statSync(tmpFile);
console.log(
  `Uploading ${tmpFile} (${(stat.size / 1024 / 1024).toFixed(2)} MB) \u2192 ${containerName}/${blobName}`,
);
await client.uploadFile(tmpFile, {
  blobHTTPHeaders: { blobContentType: "application/x-sqlite3" },
});

fs.unlinkSync(tmpFile);
console.log("Backup complete.");
