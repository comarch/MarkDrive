import { test, expect } from "@playwright/test";

// Feature coverage for roadmap phase 1. Demo mode provides a mock token
// and localStorage-backed data, so no credentials are needed.

test("search panel finds text in the document", async ({ page }) => {
  await page.goto("/");

  await page.click('button[title="Search and replace (Ctrl+F)"]');

  const searchInput = page.locator(".cm-panel input").first();
  await expect(searchInput).toBeVisible();
  await searchInput.pressSequentially("Welcome");

  await expect(page.locator(".cm-searchMatch").first()).toBeVisible();
});
