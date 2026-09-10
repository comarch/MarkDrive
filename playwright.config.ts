import { defineConfig } from "@playwright/test";

// End-to-end tests run against the Vite dev server in demo mode, so no
// Google credentials are required. Port 3111 keeps the e2e server away
// from a developer server that may already use 3000.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  // One worker keeps demo-mode browser storage isolated between tests.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3111",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    // The e2e dev server builds with the AI assistant included, so its
    // panel is testable. The production artifact is still built without
    // the flag (see docs/SECURITY_MODEL.md).
    command: "VITE_ENABLE_AI=1 npm run dev -- --port 3111 --strictPort",
    url: "http://localhost:3111",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
  },
});
