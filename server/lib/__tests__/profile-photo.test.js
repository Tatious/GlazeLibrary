import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { validateProfilePhoto } from "../profile-photo.js";

describe("validateProfilePhoto", () => {
  it("accepts supported image data URLs and removal", () => {
    assert.equal(validateProfilePhoto(null), null);
    assert.equal(
      validateProfilePhoto("data:image/webp;base64,YWJj"),
      "data:image/webp;base64,YWJj",
    );
  });

  it("rejects unsupported and oversized values", () => {
    assert.throws(() => validateProfilePhoto("https://example.com/photo.jpg"));
    const oversized = `data:image/png;base64,${"A".repeat(350_000)}`;
    assert.throws(() => validateProfilePhoto(oversized), /250 KB/);
  });
});