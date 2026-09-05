import { expect, test } from "@playwright/test";
import { adminDb } from "../server/lib/firebase-admin.js";
import {
  createTestUser,
  deleteTestUser,
  signIn,
  type TestUser,
} from "./helpers/collaboration-fixture";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUser("Photo");
});

test.afterAll(async () => {
  await deleteTestUser(user);
});

test("profile photo validates, persists, renders, and can be removed", async ({
  page,
}) => {
  await signIn(page, user);
  await page.goto("/settings");
  const photoInput = page.getByLabel(`Choose profile photo for ${user.displayName}`);

  await photoInput.setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("Choose a JPEG, PNG, or WebP image");

  await photoInput.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: PNG_1PX,
  });
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
  await expect(
    page.getByRole("main").locator('img[src^="data:image/webp;base64,"]'),
  ).toBeVisible();
  await expect.poll(async () => {
    const profile = await adminDb.collection("profiles").doc(user.uid).get();
    return profile.data()?.photo_data_url?.startsWith("data:image/webp;base64,");
  }).toBe(true);

  await page.reload();
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
  await expect(
    page.getByRole("main").locator('img[src^="data:image/webp;base64,"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: "Add photo" })).toBeVisible();
  await expect.poll(async () => {
    const profile = await adminDb.collection("profiles").doc(user.uid).get();
    return profile.data()?.photo_data_url;
  }).toBeNull();
});