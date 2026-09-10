import { test, expect } from "@playwright/test";

// Roadmap item 5: move between Markdown documents without returning to the
// Drive UI. Demo mode backs the list with browser storage.

test("file browser lists and opens markdown files", async ({ page }) => {
  await page.goto("/");

  // Demo sign in without a configured client id issues a mock token.
  await page.click('button[title="Connect Google Drive"]');
  await expect(
    page.locator('button[title="Connect Google Drive"]'),
  ).toBeHidden();

  await page.click('button[title="New document (Create in Drive)"]');
  await expect(page.locator(".cm-content")).toContainText("Untitled Document");

  await page.click('button[title="Open Markdown files"]');
  await expect(page.locator("h3", { hasText: "Markdown files" })).toBeVisible();

  const fileButton = page.locator('button:has-text("Untitled.md")').first();
  await expect(fileButton).toBeVisible();
  await fileButton.click();

  await expect(page.locator(".cm-content")).toContainText("Untitled Document");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});
