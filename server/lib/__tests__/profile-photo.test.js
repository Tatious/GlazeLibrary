import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { validateProfilePhoto } from "../profile-photo.js";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("validateProfilePhoto", () => {
  it("accepts supported image data URLs and removal", () => {
    assert.equal(validateProfilePhoto(null), null);
    assert.equal(validateProfilePhoto(PNG_DATA_URL), PNG_DATA_URL);
  });

  it("rejects unsupported and oversized values", () => {
    assert.throws(() => validateProfilePhoto("https://example.com/photo.jpg"));
    assert.throws(
      () => validateProfilePhoto("data:image/webp;base64,YWJj"),
      /does not match/,
    );
    assert.throws(
      () => validateProfilePhoto(PNG_DATA_URL.replace("image/png", "image/jpeg")),
      /does not match/,
    );
    const oversized = `data:image/png;base64,${"A".repeat(350_000)}`;
    assert.throws(() => validateProfilePhoto(oversized), /250 KB/);
  });
});