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
  return photoDataUrl;
}