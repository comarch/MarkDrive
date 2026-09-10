import { test, expect } from "@playwright/test";

// Smoke coverage for the demo-mode application shell: load, edit, switch
// views, open the comments workflow, and open the export dialog.

test("loads the editor with the sample document", async ({ page }) => {
  await page.goto("/");

  // The header swaps between a compact and a full brand image by viewport,
  // so assert that one of them is actually visible.
  const visibleBrand = page
    .locator('img[alt="Comarch MarkQuire"]')
    .filter({ visible: true });
  await expect(visibleBrand.first()).toBeVisible();
  await expect(page.locator(".cm-content")).toBeVisible();

  const preview = page.locator(".markdown-body");
  await expect(
    preview.locator("h1", { hasText: "Welcome to Comarch MarkQuire" }),
  ).toBeVisible();
});

test("typing in the editor updates the live preview", async ({ page }) => {
  await page.goto("/");

  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n## E2E added heading");

  const preview = page.locator(".markdown-body");
  await expect(
    preview.locator("h2", { hasText: "E2E added heading" }),
  ).toBeVisible();
});

test("switches between view modes", async ({ page }) => {
  await page.goto("/");

  await page.click('button[title="Preview only"]');
  await expect(page.locator(".cm-content")).toBeHidden();
  await expect(page.locator(".markdown-body")).toBeVisible();

  await page.click('button[title="Editor only"]');
  await expect(page.locator(".cm-content")).toBeVisible();
  await expect(page.locator(".markdown-body")).toBeHidden();

  await page.click('button[title="Split View"]');
  await expect(page.locator(".cm-content")).toBeVisible();
  await expect(page.locator(".markdown-body")).toBeVisible();
});

test("opens the demo comments sidebar with its sample thread", async ({
  page,
}) => {
  await page.goto("/");

  await page.click('button[title="Google Drive comments"]');

  await expect(page.locator("h2", { hasText: "Drive Comments" })).toBeVisible();
  await expect(page.getByText("Open (1)")).toBeVisible();
});

test("opens the export dialog", async ({ page }) => {
  await page.goto("/");

  await page.click('button[title="Export (Markdown, HTML, PDF)"]');

  await expect(
    page.locator("h3", { hasText: "Export Document" }),
  ).toBeVisible();
  await expect(page.getByText("Markdown (.md)")).toBeVisible();
});
