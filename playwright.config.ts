import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const inheritedE2eDbPath = process.env.PLAYWRIGHT_E2E_DB_PATH;
const e2eDbPath =
  inheritedE2eDbPath ||
  path.join(os.tmpdir(), `glaze-library-playwright-${process.pid}.db`);
if (path.dirname(e2eDbPath) !== os.tmpdir()) {
  throw new Error("Playwright database must be inside the operating-system temp directory");
}
process.env.PLAYWRIGHT_E2E_DB_PATH = e2eDbPath;
process.env.GLAZE_DB_PATH = e2eDbPath;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:5179",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev:server",
      env: { GLAZE_DB_PATH: e2eDbPath },
      url: "http://127.0.0.1:3006/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev:vite -- --port 5179",
      url: "http://127.0.0.1:5179",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});