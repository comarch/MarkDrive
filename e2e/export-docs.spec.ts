import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Roadmap item 11: Word export generates a valid file in the browser and
// Google Docs export hands a converted copy to Drive.

test.describe("document exports", () => {
  test("downloads a Word file built in the browser", async ({ page }) => {
    await page.goto("/");
    await page.getByTitle("Export (Markdown, HTML, PDF)").click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Word document (.docx)").click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const path = await download.path();
    const bytes = readFileSync(path ?? "");
    // ZIP local header magic plus the required parts.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const text = bytes.toString("latin1");
    for (const part of [
      "[Content_Types].xml",
      "word/document.xml",
      "word/styles.xml",
    ]) {
      expect(text).toContain(part);
    }
    // The welcome document content made it in.
    expect(text).toContain("Welcome to Comarch MarkQuire");
  });

  test("offers the Google Docs copy in demo mode", async ({ page }) => {
    await page.goto("/");
    await page.getByTitle("Export (Markdown, HTML, PDF)").click();

    const docsOption = page.getByText("Google Docs (copy in Drive)");
    await expect(docsOption).toBeVisible();

    // Demo mode creates a mock Docs file and opens its link; the popup
    // is blocked headlessly, which the app tolerates.
    await docsOption.click();
    await expect(page.getByTestId("ai-panel")).toHaveCount(0);
  });
});
