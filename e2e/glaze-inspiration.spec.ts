import { expect, test, type Page } from "@playwright/test";

const OWNED_GLAZE_ID = "amaco-c-01";
const SURPRISE_POOL = ["amaco-c-01", "amaco-c-10", "amaco-c-47"];

async function mockInventory(page: Page, ownedGlazeIds: string[]) {
  await page.route("**/api/inventory", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ownedGlazeIds,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      }),
    }),
  );
}

test("random inspiration respects the glaze search and owned inventory", async ({
  page,
}) => {
  await mockInventory(page, [OWNED_GLAZE_ID]);
  await page.addInitScript(() => {
    localStorage.setItem("glaze-library-glaze-filter", JSON.stringify("owned"));
  });

  await page.goto("/glazes");
  await page.getByRole("textbox", { name: "Search glazes" }).fill("Obsidian");

  const randomButton = page.getByRole("button", { name: "Surprise me" });
  await expect(randomButton).toHaveAttribute(
    "title",
    "Pick a random owned glaze from these 1 results",
  );
  await randomButton.click();

  await expect(page).toHaveURL(`/glaze/${OWNED_GLAZE_ID}`);
});

test("glaze inspiration can shuffle repeatedly without an immediate repeat", async ({
  page,
}) => {
  await mockInventory(page, SURPRISE_POOL);
  await page.addInitScript(() => {
    localStorage.setItem("glaze-library-glaze-filter", JSON.stringify("owned"));
  });

  await page.goto("/glazes");
  await page.getByRole("button", { name: "Surprise me" }).click();
  const firstPick = page.url();

  await page.getByRole("button", { name: "Shuffle again" }).click();
  await expect(page).not.toHaveURL(firstPick);
});

test("combination inspiration can shuffle repeatedly through owned results", async ({
  page,
}) => {
  await mockInventory(page, SURPRISE_POOL);
  await page.addInitScript(() => {
    localStorage.setItem(
      "glaze-library-combo-filters",
      JSON.stringify({ ownership: "owned" }),
    );
  });

  await page.goto("/combinations");
  const surpriseButton = page.getByRole("button", { name: "Surprise me" });
  await expect(surpriseButton).toBeVisible();
  await surpriseButton.click();
  const firstPick = page.url();

  await page.getByRole("button", { name: "Shuffle again" }).click();
  await expect(page).not.toHaveURL(firstPick);
});

test("glaze combination browsing does not recommend unowned glazes", async ({
  page,
}) => {
  await mockInventory(page, [OWNED_GLAZE_ID]);

  await page.goto(`/glaze/${OWNED_GLAZE_ID}/combinations`);

  await expect(
    page.getByRole("heading", { name: "No combinations you can make yet" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Show all/ })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore glazes to add" }),
  ).toHaveAttribute("href", "/glazes/shop");
});
