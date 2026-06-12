/**
 * Image processing + multer config + slot-order assembly.
 *
 * The `assembleImages` helper is the single place that knows how to turn the
 * upload form's `slotOrder` payload into a final list of image URLs owned by a
 * specific feature (currently "upload" or "piece"). Critically, if a slot
 * references a URL that belongs to a different feature (e.g. a piece photo
 * being published as a community upload), the file is COPIED into the
 * destination feature's namespace so the two features can be deleted
 * independently.
 */

import fs from "fs";
import multer from "multer";
import {
  saveImage,
  copyImage,
  getPhotoOwner,
  useAzureStorage,
  getUploadsDir,
} from "../storage.js";

// Lazy-load sharp — not always available on the target platform.
let sharp = null;
try {
  sharp = (await import("sharp")).default;
  console.log("Sharp image processing available");
} catch {
  console.log("Sharp not available — images will not be resized");
}

const MAX_DIMENSION = 1920;
const QUALITY = 85;

// When sharp is available we re-encode to JPEG so the multer limit can be
// generous (50 MB). Without sharp the raw bytes are stored as-is, so the
// limit has to double as the storage cap; keep that smaller and safer.
const MAX_UPLOAD_BYTES = sharp ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

/**
 * Resize + recompress an image to a reasonable size. Returns a Buffer.
 * Accepts either a path (local disk) or a Buffer (Azure memory storage).
 */
export async function processImage(input) {
  if (!sharp) {
    if (Buffer.isBuffer(input)) return input;
    return fs.readFileSync(input);
  }
  try {
    const image = sharp(input);
    const metadata = await image.metadata();
    let pipeline = image;
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    return await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  } catch (error) {
    console.error("Image processing error:", error);
    if (Buffer.isBuffer(input)) return input;
    return fs.readFileSync(input);
  }
}

/**
 * Multer instance: memory storage in Azure (so we can buffer before uploading
 * to blob), disk storage locally (so we don't hold large files in RAM).
 */
export const upload = multer({
  storage: useAzureStorage
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => cb(null, getUploadsDir()),
        filename: (req, file, cb) => cb(null, `${Date.now()}.jpg`),
      }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

/**
 * Process + save the multer file at index `i`, returning the public URL.
 */
async function saveProcessedFile(file, userId, idx) {
  const filename = `${Date.now()}-${idx}.jpg`;
  const input = useAzureStorage ? file.buffer : file.path;
  const processed = await processImage(input);
  const url = await saveImage(processed, userId, filename);
  if (!useAzureStorage && file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
  return url;
}

/**
 * Assemble the final ordered list of image URLs for an upload entry.
 *
 * `slotOrder` items are either:
 *   - `{ t: "f", i: <index into files> }` \u2014 a newly uploaded file
 *   - `{ t: "e" | "u", u: "<url>" }`     \u2014 a reference to an existing URL
 *
 * Any reference whose photo is owned by a different feature is COPIED into
 * `destOwner`'s namespace under `userId`, so the new entry owns the file.
 */
export async function assembleImages({
  files = [],
  slotOrder = null,
  existingFallback = [],
  userId,
  destOwner = "upload",
}) {
  // 1. Save all newly uploaded files first so we can address them by index.
  const newFileUrls = [];
  for (let i = 0; i < files.length; i++) {
    newFileUrls.push(await saveProcessedFile(files[i], userId, i));
  }

  // 2. Build the raw ordered list of URLs (mixing new files and references).
  let raw;
  if (slotOrder) {
    raw = slotOrder
      .map((s) => (s.t === "f" ? newFileUrls[s.i] : s.u))
      .filter(Boolean);
  } else {
    raw = [...existingFallback, ...newFileUrls];
  }

  // 3. Make sure every URL is owned by `destOwner`. Copy any cross-owner refs.
  const final = [];
  for (const url of raw) {
    const owner = getPhotoOwner(url);
    if (owner === destOwner || owner === "external" || owner === "unknown") {
      // Already ours, or not a managed image (leave as-is)
      final.push(url);
      continue;
    }
    // Cross-feature reference \u2014 copy into our namespace
    try {
      const filename = `${Date.now()}-copy-${final.length}.jpg`;
      const copied = await copyImage(url, destOwner, userId, filename);
      final.push(copied);
    } catch (err) {
      console.error(`assembleImages: failed to copy ${url}:`, err.message);
      // Skip this photo rather than fail the whole save.
    }
  }
  return final;
}
