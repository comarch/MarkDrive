import { expect, test } from "@playwright/test";

// Roadmap item 12: the offline shell service worker ships with the app.
// Registration only happens in production builds, so e2e verifies the
// script is deployed and well-formed; queue replay logic is unit tested
// with mocked Drive callbacks.

test("serves the offline shell service worker", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.status()).toBe(200);
  const body = await response.text();
  // Cache names and the fetch strategy are the contract.
  expect(body).toContain("markquire-shell-v1");
  expect(body).toContain("markquire-runtime-v1");
  // Cross-origin traffic (Google APIs) must stay uncached.
  expect(body).toContain("url.origin !== self.location.origin");
});
