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

test("checking a task in the preview updates the markdown source", async ({
  page,
}) => {
  await page.goto("/");

  const unchecked = page
    .locator("input.task-list-item-checkbox:not([checked])")
    .first();
  await expect(unchecked).toBeVisible();
  await unchecked.click();

  await expect(page.locator(".cm-content")).toContainText(
    "[x] Export directly to team Google Workspace Drive folder",
  );
  await expect(
    page.locator("input.task-list-item-checkbox[checked]"),
  ).toHaveCount(4);
});
