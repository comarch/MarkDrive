import { test, expect } from "@playwright/test";

// Roadmap item 10: the table context toolbar appears while the cursor is
// inside a Markdown table and edits the block around it.

test("table toolbar edits the table around the cursor", async ({ page }) => {
  await page.goto("/");

  // CodeMirror only renders lines near the viewport, so bring the sample
  // table into view before clicking it.
  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller");
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight * 0.45;
    }
  });

  const tableLine = page
    .locator(".cm-line")
    .filter({ hasText: "| Google Drive |" })
    .first();
  await expect(tableLine).toBeVisible();
  await tableLine.click();

  const toolbar = page.locator('button[title="Insert row below"]');
  await expect(toolbar).toBeVisible();
  await toolbar.click();

  const editor = page.locator(".cm-content");
  await expect(editor).toContainText("|        |        |");

  // Column removal through the toolbar keeps the rest of the table.
  const removeColumn = page.locator(
    'button[title="Remove the current column"]',
  );
  await removeColumn.click();
  await expect(editor).toContainText("| Supported | Storage |");
});
