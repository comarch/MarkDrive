import { expect, test } from "@playwright/test";

// Roadmap item 25: the WYSIWYG overlay hides raw Markdown marks in the
// editor without touching the document bytes.

async function replaceDocument(page, text) {
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
}

test.describe("rich view WYSIWYG overlay", () => {
  test("hides Markdown marks without changing the document bytes", async ({
    page,
  }) => {
    await page.goto("/");
    await replaceDocument(
      page,
      "# Title\n\n**bold** and *italic* text with `code`\n",
    );

    // Source mode shows raw marks.
    await expect(page.locator(".cm-content")).toContainText("**bold**");

    // Toggle rich view: marks disappear from the rendered lines.
    await page.getByTitle("Rich text view").click();
    await expect(page.locator(".cm-content")).toContainText(
      "bold and italic text with code",
    );
    const lineText = await page.locator(".cm-content").innerText();
    expect(lineText).not.toContain("**");
    expect(lineText).not.toContain("`");
    expect(lineText).not.toContain("#");
    // Headings and emphasis carry their styling classes.
    await expect(page.locator(".cm-content .cm-rich-h1")).toHaveCount(1);
    await expect(page.locator(".cm-content .cm-rich-bold")).toHaveCount(1);
    await expect(page.locator(".cm-content .cm-rich-italic")).toHaveCount(1);

    // The preview keeps rendering the original Markdown, proving the
    // overlay never mutated the document.
    await expect(page.locator(".preview-container")).toContainText(
      "bold and italic text with code",
    );

    // Toggle off: raw marks return, so the bytes survived the overlay.
    await page.getByTitle("Rich text view").click();
    await expect(page.locator(".cm-content")).toContainText("**bold**");
    await expect(page.locator(".cm-content")).toContainText("`code`");
  });

  test("styles links as labels only", async ({ page }) => {
    await page.goto("/");
    await replaceDocument(
      page,
      "See [the docs](https://external.example/guide) for details\n",
    );

    await page.getByTitle("Rich text view").click();
    const text = await page.locator(".cm-content").innerText();
    expect(text).toContain("See the docs for details");
    expect(text).not.toContain("https://");
    await expect(page.locator(".cm-content .cm-rich-link-text")).toHaveCount(1);

    // Toggle off restores the raw link syntax.
    await page.getByTitle("Rich text view").click();
    await expect(page.locator(".cm-content")).toContainText(
      "[the docs](https://external.example/guide)",
    );
  });
});
