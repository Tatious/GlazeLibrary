/**
 * Photo ownership invariant tests.
 *
 * `getPhotoOwner` is the single source of truth for whether a stored photo
 * URL belongs to a piece, an upload, an external source, or is unknown.
 * It's consulted before every photo deletion and during cross-feature copy
 * (publishing a piece photo as a community upload), so a regression here is
 * a data-loss bug.
 *
 * Run with: `node --test server/lib/__tests__/storage.test.js`
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { getPhotoOwner } from "../../storage.js";

describe("getPhotoOwner", () => {
  it("recognises piece photos by path", () => {
    assert.equal(
      getPhotoOwner("/uploads/pieces/user-123/photo.jpg"),
      "piece",
    );
    assert.equal(
      getPhotoOwner(
        "https://example.blob.core.windows.net/glaze-data/uploads/pieces/u/p.jpg",
      ),
      "piece",
    );
  });

  it("recognises upload photos by path", () => {
    assert.equal(
      getPhotoOwner("/uploads/user-combinations/user-123/photo.jpg"),
      "upload",
    );
    assert.equal(
      getPhotoOwner(
        "https://example.blob.core.windows.net/glaze-data/uploads/user-combinations/u/p.jpg",
      ),
      "upload",
    );
  });

  it("treats other absolute URLs as external (scraped manufacturer photos)", () => {
    assert.equal(
      getPhotoOwner("https://amaco.com/images/glazes/pc-30.jpg"),
      "external",
    );
    assert.equal(
      getPhotoOwner("http://example.com/photo.png"),
      "external",
    );
  });

  it("returns 'unknown' for unrecognised or empty input", () => {
    assert.equal(getPhotoOwner(""), "unknown");
    assert.equal(getPhotoOwner(null), "unknown");
    assert.equal(getPhotoOwner(undefined), "unknown");
    assert.equal(getPhotoOwner("/some/other/path.jpg"), "unknown");
  });
});
