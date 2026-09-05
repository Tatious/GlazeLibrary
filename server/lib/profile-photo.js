const MAX_PHOTO_BYTES = 250 * 1024;
const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export function validateProfilePhoto(photoDataUrl) {
  if (photoDataUrl === null) return null;
  if (typeof photoDataUrl !== "string") {
    throw new Error("Profile photo must be an image or null");
  }
  const match = photoDataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error("Profile photo must be a JPEG, PNG, or WebP image");
  }
  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((match[2].length * 3) / 4) - padding;
  if (decodedBytes > MAX_PHOTO_BYTES) {
    throw new Error("Profile photo must be smaller than 250 KB");
  }
  const bytes = Buffer.from(match[2], "base64");
  const mimeType = match[1];
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  const isWebp =
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (
    (mimeType === "jpeg" && !isJpeg) ||
    (mimeType === "png" && !isPng) ||
    (mimeType === "webp" && !isWebp)
  ) {
    throw new Error("Profile photo content does not match its image type");
  }
  return photoDataUrl;
}