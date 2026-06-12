/**
 * Glaze utility functions
 */

import type { Glaze, GlazeImage, GlazeCombination } from "../types/models";

// CDN URL for production (Azure Blob Storage)
const AZURE_CDN_URL = import.meta.env.VITE_AZURE_CDN_URL || "";

/**
 * Prefix a relative path with the CDN URL if available
 */
export function prefixCdnUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  // If already a full URL, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Otherwise prefix with CDN URL if available
  return AZURE_CDN_URL ? `${AZURE_CDN_URL}${path}` : path;
}

/**
 * Get the primary image URL for a glaze
 * Falls back through various sources if primary not marked
 */
export function getPrimaryImage(glaze: Glaze): string | undefined {
  if (!glaze.images || glaze.images.length === 0) {
    return undefined;
  }

  // First try to find the marked primary image
  const primary = glaze.images.find((img) => img.isPrimary);
  if (primary) {
    return prefixCdnUrl(primary.localPath || primary.originalUrl);
  }

  // Fallback: prefer 'product' type images
  const product = glaze.images.find((img) => img.type === "product");
  if (product) {
    return prefixCdnUrl(product.localPath || product.originalUrl);
  }

  // Fallback: prefer 'main' type images
  const main = glaze.images.find((img) => img.type === "main");
  if (main) {
    return prefixCdnUrl(main.localPath || main.originalUrl);
  }

  // Last resort: first image
  const first = glaze.images[0];
  return prefixCdnUrl(first?.localPath || first?.originalUrl);
}

/**
 * Get the cover image URL for a glaze combination
 * Falls back to first entry's first photo
 */
export function getCombinationImage(
  combination: GlazeCombination,
): string | undefined {
  if (!combination.entries || combination.entries.length === 0) {
    return undefined;
  }

  // Find a cover photo first
  for (const entry of combination.entries) {
    if (entry.photos && entry.photos.length > 0) {
      const cover = entry.photos.find((p) => p.isCover);
      if (cover) {
        return prefixCdnUrl(cover.url);
      }
    }
  }

  // Fallback: first photo from first entry
  const firstEntry = combination.entries[0];
  if (firstEntry.photos && firstEntry.photos.length > 0) {
    return prefixCdnUrl(firstEntry.photos[0].url);
  }

  return undefined;
}

/**
 * Get image URL with fallback to original if local not available
 */
export function getImageUrl(image: GlazeImage): string {
  return prefixCdnUrl(image.localPath || image.originalUrl) || "";
}
