import { after, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "glaze-members-"));
process.env.GLAZE_DB_PATH = path.join(testDirectory, "test.db");

const { Migrations, Pieces, ResourceMembers } = await import("../repositories.js");
Migrations.addResourceMembersTable();
Migrations.addResourceMemberStatusColumn();

after(() => {
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

describe("ResourceMembers invitations", () => {
  it("grants editor access only after acceptance", () => {
    const invitation = ResourceMembers.invite(
      "piece",
      "piece-1",
      "invitee-1",
      "editor",
      "owner-1",
    );

    assert.equal(invitation.status, "pending");
    assert.equal(ResourceMembers.getRole("piece", "piece-1", "invitee-1"), null);

    const accepted = ResourceMembers.accept("piece", "piece-1", "invitee-1");
    assert.equal(accepted.status, "accepted");
    assert.equal(
      ResourceMembers.getRole("piece", "piece-1", "invitee-1"),
      "editor",
    );
  });

  it("removes rejected invitations without granting access", () => {
    ResourceMembers.invite(
      "piece",
      "piece-2",
      "invitee-2",
      "editor",
      "owner-1",
    );
    assert.equal(ResourceMembers.remove("piece", "piece-2", "invitee-2"), true);
    assert.equal(ResourceMembers.get("piece", "piece-2", "invitee-2"), null);
  });
});

describe("Pieces published entry links", () => {
  it("finds links regardless of who owns the piece", () => {
    const now = new Date().toISOString();
    for (const [id, userId, entryId] of [
      ["piece-linked-owner", "owner-1", "entry-shared"],
      ["piece-linked-editor", "owner-2", "entry-shared"],
      ["piece-unrelated", "owner-1", "entry-other"],
    ]) {
      Pieces.insert({
        id,
        userId,
        name: id,
        currentStage: "greenware",
        stageRecords: [],
        glazes: [],
        publishedEntries: [{ comboId: "combo-1", entryId }],
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    assert.deepEqual(
      Pieces.listLinkedToPublishedEntry("entry-shared")
        .map((piece) => piece.id)
        .sort(),
      ["piece-linked-editor", "piece-linked-owner"],
    );

    assert.equal(
      Pieces.updatePublishedEntryCombination("entry-shared", "combo-updated"),
      2,
    );
    for (const pieceId of ["piece-linked-owner", "piece-linked-editor"]) {
      assert.deepEqual(Pieces.get(pieceId).publishedEntries, [
        { comboId: "combo-updated", entryId: "entry-shared" },
      ]);
    }
    assert.deepEqual(Pieces.get("piece-unrelated").publishedEntries, [
      { comboId: "combo-1", entryId: "entry-other" },
    ]);
  });
});