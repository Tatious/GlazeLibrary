import { expect, test, type Page } from "@playwright/test";

const STORE_KEY = "@tatious/ui:scroll-restoration:glaze-library";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "glaze-library-glaze-filter",
      JSON.stringify("all"),
    );
  });
});

async function waitForGlazeList(page: Page) {
  await page.locator('a[href^="/glaze/"] h3').first().waitFor({
    state: "attached",
  });
  await page.waitForFunction(
    () => document.documentElement.scrollHeight - window.innerHeight > 3_000,
  );
}

async function visibleGlazeLink(page: Page) {
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll('a[href^="/glaze/"] h3')].find(
      (candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.top > 80 && rect.bottom < window.innerHeight - 20;
      },
    );
    if (!heading) return null;

    const rect = heading.getBoundingClientRect();
    return {
      href: heading.closest("a")?.getAttribute("href") ?? null,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
}

async function entrySnapshot(page: Page) {
  return page.evaluate((storeKey) => {
    const routerKey = window.history.state?.key as string | undefined;
    const key =
      routerKey && routerKey !== "default"
        ? routerKey
        : `default:${location.pathname}${location.search}${location.hash}`;
    const store = JSON.parse(sessionStorage.getItem(storeKey) ?? "{}") as {
      positions?: Record<string, { y?: number }>;
    };

    return {
      key,
      savedY: store.positions?.[key]?.y ?? null,
      y: Math.round(window.scrollY),
    };
  }, STORE_KEY);
}

test("resets PUSH and restores repeated POP history traversals", async ({ page }) => {
  await page.setViewportSize({ width: 1_000, height: 500 });
  const listUrl = `/glazes?scroll-e2e=${Date.now()}`;
  await page.goto(listUrl);
  await waitForGlazeList(page);

  await page.mouse.move(500, 400);
  await page.mouse.wheel(0, 2_400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1_000);

  const point = await visibleGlazeLink(page);
  expect(point?.href).toBeTruthy();
  await page.mouse.click(point!.x, point!.y);
  await page.waitForFunction(
    (href) => location.pathname === href && document.querySelector("main h1"),
    point!.href,
  );

  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(3);
  const sourceAfterPush = await page.evaluate(
    ({ key, storeKey }) => {
      const store = JSON.parse(sessionStorage.getItem(storeKey) ?? "{}") as {
        positions?: Record<string, { y?: number }>;
      };
      return store.positions?.[key]?.y ?? null;
    },
    { key: `default:${listUrl}`, storeKey: STORE_KEY },
  );
  expect(sourceAfterPush).toBeGreaterThan(1_000);

  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const detail = await entrySnapshot(page);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${listUrl.replace("?", "\\?")}$`));
  await waitForGlazeList(page);
  await expect
    .poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), sourceAfterPush))
    .toBeLessThan(3);
  await page.waitForTimeout(1_000);
  await expect
    .poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), sourceAfterPush))
    .toBeLessThan(3);

  await page.goForward();
  await page.waitForFunction(
    (href) => location.pathname === href && document.querySelector("main h1"),
    point!.href,
  );
  await expect
    .poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), detail.y))
    .toBeLessThan(3);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${listUrl.replace("?", "\\?")}$`));
  await waitForGlazeList(page);
  await expect
    .poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), sourceAfterPush))
    .toBeLessThan(3);

  await page.goForward();
  await page.waitForFunction(
    (href) => location.pathname === href && document.querySelector("main h1"),
    point!.href,
  );
  await expect
    .poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), detail.y))
    .toBeLessThan(3);
});

test("captures a programmatic PUSH before the route can commit", async ({ page }) => {
  const listUrl = `/glazes?programmatic-e2e=${Date.now()}`;
  await page.goto(listUrl);
  await waitForGlazeList(page);

  const result = await page.evaluate(
    ({ listUrl, storeKey }) => {
      const routerKey = window.history.state?.key as string | undefined;
      const key =
        routerKey && routerKey !== "default"
          ? routerKey
          : `default:${listUrl}`;
      window.scrollTo(0, 1_200);
      const departureY = Math.round(window.scrollY);
      window.history.pushState(
        { ...(window.history.state ?? {}), key: "programmatic-e2e" },
        "",
        "/glaze/programmatic-e2e",
      );
      const store = JSON.parse(sessionStorage.getItem(storeKey) ?? "{}") as {
        positions?: Record<string, { y?: number }>;
      };
      return { departureY, savedY: store.positions?.[key]?.y ?? null };
    },
    { listUrl, storeKey: STORE_KEY },
  );

  expect(result.departureY).toBeGreaterThan(1_000);
  expect(result.savedY).toBe(result.departureY);
});