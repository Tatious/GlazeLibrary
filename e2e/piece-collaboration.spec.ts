import { expect, test, type BrowserContext } from "@playwright/test";
import {
  authenticatedJson,
  createTestPiece,
  createTestUser,
  deleteTestPiece,
  deleteTestUser,
  signIn,
  type TestUser,
} from "./helpers/collaboration-fixture";

test.setTimeout(60_000);

let owner: TestUser;
let collaborator: TestUser;
let pieceId = "";
let protectedPieceId = "";
const protectedPhotoUrl = "/uploads/pieces/protected-owner/protected.jpg";
let originalName = "";

test.beforeAll(async () => {
  owner = await createTestUser("Owner");
  collaborator = await createTestUser("Collaborator");
  const piece = createTestPiece(owner.uid);
  pieceId = piece.id;
  originalName = piece.name;
  protectedPieceId = createTestPiece(owner.uid, {
    name: "Protected photo piece",
    stageRecords: [
      {
        stage: "bisqueware",
        date: new Date().toISOString(),
        photos: [protectedPhotoUrl],
      },
    ],
  }).id;
});

test.afterAll(async () => {
  deleteTestPiece(pieceId);
  deleteTestPiece(protectedPieceId);
  await deleteTestUser(owner);
  await deleteTestUser(collaborator);
});

test("owner invites, collaborator accepts and edits, owner revokes", async ({
  browser,
  page: ownerPage,
}) => {
  let collaboratorContext: BrowserContext | undefined;
  try {
    await signIn(ownerPage, owner);
    await ownerPage.goto(`/pieces/${pieceId}`);

    const peopleSearch = ownerPage.getByRole("combobox", {
      name: "Search people or enter email",
    });
    await peopleSearch.fill(collaborator.displayName);
    await expect(
      ownerPage.getByRole("option", { name: collaborator.displayName }),
    ).toBeVisible();
    await ownerPage.getByRole("option", { name: collaborator.displayName }).click();
    await ownerPage.getByRole("button", { name: "Invite" }).click();
    await expect(ownerPage.getByText("Invitation sent")).toBeVisible();
    await expect(ownerPage.getByText("Invitation pending")).toBeVisible();

    collaboratorContext = await browser.newContext();
    const collaboratorPage = await collaboratorContext.newPage();
    await signIn(collaboratorPage, collaborator);
    await collaboratorPage.goto("/pieces");
    await expect(collaboratorPage.getByRole("heading", { name: "Invitations" })).toBeVisible();
    await expect(collaboratorPage.getByText(originalName, { exact: true })).toBeVisible();
    await collaboratorPage.getByRole("button", { name: "Accept" }).click();
    await expect(collaboratorPage.getByRole("heading", { name: "Shared with you" })).toBeVisible();

    await collaboratorPage.locator(`a[href="/pieces/${pieceId}"]`).click();
    await expect(collaboratorPage.getByRole("button", { name: "Edit details" })).toBeVisible();
    await expect(collaboratorPage.getByRole("heading", { name: "People" })).toHaveCount(0);
    await expect(collaboratorPage.getByText("Archive piece")).toHaveCount(0);

    expect(
      (await authenticatedJson(collaboratorPage, `/api/pieces/${pieceId}`, {
        method: "PUT",
        body: { isArchived: true },
      })).status,
    ).toBe(403);
    expect(
      (await authenticatedJson(collaboratorPage, `/api/pieces/${pieceId}`, {
        method: "DELETE",
      })).status,
    ).toBe(403);
    expect(
      (await authenticatedJson(
        collaboratorPage,
        `/api/pieces/${pieceId}/collaborators`,
      )).status,
    ).toBe(403);
    expect(
      (await authenticatedJson(
        collaboratorPage,
        `/api/pieces/${pieceId}/people/search`,
        { method: "POST", body: { query: owner.displayName } },
      )).status,
    ).toBe(403);
    expect(
      (await authenticatedJson(
        collaboratorPage,
        `/api/pieces/${pieceId}/invitations`,
        { method: "POST", body: { userId: owner.uid } },
      )).status,
    ).toBe(403);
    expect(
      (await authenticatedJson(
        collaboratorPage,
        `/api/pieces/${pieceId}/collaborators/${owner.uid}`,
        { method: "DELETE" },
      )).status,
    ).toBe(403);
    const editablePiece = await authenticatedJson(
      collaboratorPage,
      `/api/pieces/${pieceId}`,
    );
    const injectedStageRecords = editablePiece.body.piece.stageRecords.map(
      (record: { stage: string; photos: string[] }) =>
        record.stage === "bisqueware"
          ? { ...record, photos: [...record.photos, protectedPhotoUrl] }
          : record,
    );
    expect(
      (await authenticatedJson(collaboratorPage, `/api/pieces/${pieceId}`, {
        method: "PUT",
        body: { stageRecords: injectedStageRecords },
      })).status,
    ).toBe(400);
    const crossPieceDelete = await authenticatedJson(
      collaboratorPage,
      `/api/pieces/${pieceId}/photo?stage=bisqueware&photoUrl=${encodeURIComponent(protectedPhotoUrl)}`,
      { method: "DELETE" },
    );
    expect(crossPieceDelete.status).toBe(404);
    const protectedPiece = await authenticatedJson(
      collaboratorPage,
      `/api/pieces/${protectedPieceId}`,
    );
    expect(protectedPiece.body.piece.stageRecords[0].photos).toContain(
      protectedPhotoUrl,
    );

    const editedName = `${originalName} edited`;
    await collaboratorPage.getByRole("button", { name: "Edit details" }).click();
    await collaboratorPage.getByLabel("Piece name").fill(editedName);
    await collaboratorPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(collaboratorPage.getByRole("heading", { name: editedName })).toBeVisible();
    await expect(collaboratorPage.getByRole("button", { name: "Edit details" })).toBeVisible();

    await ownerPage.reload();
    await expect(ownerPage.getByRole("heading", { name: editedName })).toBeVisible();
    await ownerPage.getByRole("button", { name: `Remove ${collaborator.displayName}` }).click();
    await expect(ownerPage.getByText(collaborator.displayName)).toHaveCount(0);

    await collaboratorPage.reload();
    await expect(collaboratorPage.getByText("View only")).toBeVisible();
    await expect(collaboratorPage.getByRole("button", { name: "Edit details" })).toHaveCount(0);
    expect(
      (await authenticatedJson(collaboratorPage, `/api/pieces/${pieceId}`, {
        method: "PUT",
        body: { name: "Revoked edit" },
      })).status,
    ).toBe(403);
  } finally {
    await collaboratorContext?.close();
  }
});

test("invalid, self, duplicate, pending, cancellation, and rejection paths", async ({
  browser,
  page: ownerPage,
}) => {
  let inviteeContext: BrowserContext | undefined;
  try {
    await signIn(ownerPage, owner);
    await ownerPage.goto(`/pieces/${pieceId}`);
    const search = ownerPage.getByRole("combobox", {
      name: "Search people or enter email",
    });

    await search.fill(owner.email);
    await ownerPage.getByRole("button", { name: "Invite" }).click();
    await expect(ownerPage.getByText("You already own this piece")).toBeVisible();

    await search.fill(`missing-${Date.now()}@example.com`);
    await ownerPage.getByRole("button", { name: "Invite" }).click();
    await expect(ownerPage.getByText("No account uses that email")).toBeVisible();

    await search.fill(collaborator.email);
    await ownerPage.getByRole("button", { name: "Invite" }).click();
    await expect(ownerPage.getByText("Invitation pending")).toBeVisible();

    await search.fill(collaborator.email);
    await ownerPage.getByRole("button", { name: "Invite" }).click();
    await expect(
      ownerPage.getByText("That user already has a pending invitation"),
    ).toBeVisible();

    await ownerPage.getByRole("button", { name: "Cancel invitation" }).click();
    await expect(ownerPage.getByText("Invitation pending")).toHaveCount(0);

    await search.fill(collaborator.displayName);
    await expect(
      ownerPage.getByRole("option", { name: collaborator.displayName }),
    ).toBeVisible();
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(search).toHaveValue(collaborator.displayName);
    await ownerPage.getByRole("button", { name: "Invite" }).click();

    inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    await signIn(inviteePage, collaborator);
    await inviteePage.goto(`/pieces/${pieceId}`);
    await expect(inviteePage.getByText("View only")).toBeVisible();
    await expect(inviteePage.getByRole("button", { name: "Edit details" })).toHaveCount(0);
    expect(
      (await authenticatedJson(inviteePage, `/api/pieces/${pieceId}`, {
        method: "PUT",
        body: { name: "Pending edit" },
      })).status,
    ).toBe(403);

    await inviteePage.goto("/pieces");
    await inviteePage.getByRole("button", { name: "Decline" }).click();
    await expect(inviteePage.getByRole("heading", { name: "Invitations" })).toHaveCount(0);

    await ownerPage.reload();
    await expect(ownerPage.getByText(collaborator.displayName)).toHaveCount(0);
  } finally {
    await inviteeContext?.close();
  }
});