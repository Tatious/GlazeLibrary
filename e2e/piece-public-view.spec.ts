import { expect, test } from "@playwright/test";
import {
  createTestPiece,
  deleteTestPiece,
} from "./helpers/collaboration-fixture";

let pieceId = "";

test.beforeAll(() => {
  const now = new Date().toISOString();
  const piece = createTestPiece(`public-owner-${Date.now()}`, {
    name: "Public E2E Piece",
    stageRecords: [
      {
        stage: "bisqueware",
        date: now,
        photos: ["/icon.svg"],
        notes: "Public stage notes",
      },
    ],
  });
  pieceId = piece.id;
});

test.afterAll(() => deleteTestPiece(pieceId));

test("anonymous visitors see piece content but cannot mutate it", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/pieces/${pieceId}`);

  await expect(page.getByRole("heading", { name: "Public E2E Piece" })).toBeVisible();
  await expect(page.getByText("View only")).toBeVisible();
  await expect(page.getByRole("button", { name: "View Bisqueware photo 1" })).toBeVisible();
  await expect(page.getByText("Public stage notes")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Glaze Plan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "SC-27 Sour Apple" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Glaze Inspo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "HF-56 Red Gloss" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Edit details" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add photo|Add notes|Archive piece/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "People" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);

  await page.getByRole("button", { name: "View Bisqueware photo 1" }).click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();

  const updateResponse = await request.put(`/api/pieces/${pieceId}`, {
    data: { name: "Unauthorized rename" },
  });
  expect(updateResponse.status()).toBe(401);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Public E2E Piece" })).toBeVisible();
});