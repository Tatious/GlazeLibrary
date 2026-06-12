/**
 * Storage abstraction layer
 * Supports local file system (development) and Azure Blob Storage (production)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect environment - Azure sets WEBSITE_INSTANCE_ID
const isAzure = !!process.env.WEBSITE_INSTANCE_ID;
const useAzureStorage = !!process.env.AZURE_STORAGE_CONNECTION_STRING;

console.log(`Storage mode: ${useAzureStorage ? "Azure Blob Storage" : "Local File System"}`);

// ============================================================================
// Azure Blob Storage Implementation
// ============================================================================

let blobServiceClient = null;
let containerClient = null;

async function initAzureStorage() {
  if (!useAzureStorage) return;
  
  try {
    // Dynamic import to avoid requiring the package in local dev
    const { BlobServiceClient } = await import("@azure/storage-blob");
    
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER || "glaze-data";
    
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Create container if it doesn't exist
    await containerClient.createIfNotExists({
      access: "blob", // Public read access for images
    });
    
    console.log(`Azure Blob Storage initialized: container '${containerName}'`);
  } catch (error) {
    console.error("Failed to initialize Azure Blob Storage:", error);
    throw error;
  }
}

// ============================================================================
// Local File System Paths
// ============================================================================

const LOCAL_PATHS = {
  uploadsDir: path.join(__dirname, "../public/uploads/user-combinations"),
  publicDir: path.join(__dirname, "../public"),
};

if (!useAzureStorage && !fs.existsSync(LOCAL_PATHS.uploadsDir)) {
  fs.mkdirSync(LOCAL_PATHS.uploadsDir, { recursive: true });
}

// ============================================================================
// Image Upload Storage
// ============================================================================

/**
 * Save an uploaded image file
 * Returns the public URL path
 */
async function saveImage(buffer, userId, filename) {
  const relativePath = `uploads/user-combinations/${userId}/${filename}`;
  
  if (useAzureStorage) {
    const blockBlobClient = containerClient.getBlockBlobClient(relativePath);
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: "image/jpeg" },
    });
    // Return the full Azure blob URL
    return blockBlobClient.url;
  } else {
    const userDir = path.join(LOCAL_PATHS.uploadsDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const filePath = path.join(userDir, filename);
    fs.writeFileSync(filePath, buffer);
    // Return the relative URL for local serving
    return `/${relativePath}`;
  }
}

/**
 * Save an uploaded piece photo
 * Returns the public URL path
 */
async function savePieceImage(buffer, userId, filename) {
  const relativePath = `uploads/pieces/${userId}/${filename}`;

  if (useAzureStorage) {
    const blockBlobClient = containerClient.getBlockBlobClient(relativePath);
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: "image/jpeg" },
    });
    return blockBlobClient.url;
  } else {
    const piecesDir = path.join(LOCAL_PATHS.publicDir, "uploads", "pieces", userId);
    if (!fs.existsSync(piecesDir)) {
      fs.mkdirSync(piecesDir, { recursive: true });
    }
    const filePath = path.join(piecesDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/${relativePath}`;
  }
}

/**
 * Delete an uploaded image file
 */
async function deleteImage(imageUrl) {
  if (!imageUrl) return;
  if (useAzureStorage) {
    try {
      const blobName = urlToBlobName(imageUrl);
      if (!blobName) return;
      const blobClient = containerClient.getBlobClient(blobName);
      await blobClient.deleteIfExists();
    } catch (error) {
      console.error("Error deleting blob:", error);
    }
  } else {
    const filePath = urlToLocalPath(imageUrl);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Categorize a stored image URL by which feature owns the file.
 * Used to decide whether deleting an entry should also delete its photos.
 */
function getPhotoOwner(url) {
  if (!url) return "unknown";
  if (url.includes("/uploads/pieces/")) return "piece";
  if (url.includes("/uploads/user-combinations/")) return "upload";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // Non-blob external image (scraped manufacturer photos, etc.)
    return "external";
  }
  return "unknown";
}

/**
 * Normalize a stored image URL to its blob name within the configured container.
 * Returns null if the URL is not from our own storage.
 */
function urlToBlobName(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const parsed = new URL(imageUrl);
      // pathname is /<container>/<blob path>
      return parsed.pathname.split("/").slice(2).join("/");
    } catch {
      return null;
    }
  }
  return imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
}

/**
 * Map a stored image URL (local relative path) to an absolute filesystem path
 * under the public directory. Returns null if the URL isn't a local path.
 */
function urlToLocalPath(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return null;
  return path.join(LOCAL_PATHS.publicDir, imageUrl);
}

/**
 * Copy an existing stored image into a different feature's namespace so the
 * new owner can manage (and delete) the copy independently of the source.
 *
 * Used when publishing a piece's fired-stage photo as a community upload: we
 * never want a piece deletion to break the upload (or vice versa).
 */
async function copyImage(sourceUrl, destOwner, destUserId, destFilename) {
  if (destOwner !== "upload" && destOwner !== "piece") {
    throw new Error(`copyImage: unknown destOwner '${destOwner}'`);
  }
  const destRelativePath =
    destOwner === "piece"
      ? `uploads/pieces/${destUserId}/${destFilename}`
      : `uploads/user-combinations/${destUserId}/${destFilename}`;

  if (useAzureStorage) {
    const sourceBlobName = urlToBlobName(sourceUrl);
    if (!sourceBlobName) {
      throw new Error(`copyImage: cannot resolve blob from ${sourceUrl}`);
    }
    const sourceBlobClient = containerClient.getBlobClient(sourceBlobName);
    const destBlockBlobClient = containerClient.getBlockBlobClient(destRelativePath);
    // Server-side copy — no download/upload round trip.
    await destBlockBlobClient.syncCopyFromURL(sourceBlobClient.url);
    return destBlockBlobClient.url;
  }

  const sourcePath = urlToLocalPath(sourceUrl);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error(`copyImage: source file not found at ${sourceUrl}`);
  }
  const destPath = path.join(LOCAL_PATHS.publicDir, destRelativePath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
  return `/${destRelativePath}`;
}

/**
 * Get user uploads directory for multer (local only)
 */
function getUploadsDir() {
  return LOCAL_PATHS.uploadsDir;
}

// ============================================================================
// Exports
// ============================================================================

export {
  initAzureStorage,
  saveImage,
  savePieceImage,
  copyImage,
  deleteImage,
  getPhotoOwner,
  urlToBlobName,
  urlToLocalPath,
  getUploadsDir,
  useAzureStorage,
  isAzure,
};
