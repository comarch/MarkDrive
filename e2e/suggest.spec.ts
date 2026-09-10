import { expect, test } from "@playwright/test";

test.describe("suggestion mode", () => {
  test("records edits as a reviewable suggestion comment", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".cm-content")).toContainText(
      "Welcome to Comarch MarkQuire",
    );

    // Enter suggestion mode from the header switch.
    await page.getByRole("button", { name: "Suggest" }).click();
    await expect(
      page.getByText("Edits are recorded as suggestions for review"),
    ).toBeVisible();
    await expect(page.getByText("0 pending changes")).toBeVisible();

    // Replace the first heading line while suggesting.
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.type("# Suggested heading");

    await expect(page.getByText("1 pending change")).toBeVisible();

    // Submitting creates a comment thread and restores the original text.
    await page.getByRole("button", { name: "Submit suggestions" }).click();
    await expect(page.getByText("Suggested edit (1)")).toBeVisible();
    await expect(editor).toContainText("Welcome to Comarch MarkQuire");
    await expect(editor).not.toContainText("Suggested heading");

    // The suggestion card shows the proposed change.
    await expect(
      page.getByText("- # Welcome to Comarch MarkQuire"),
    ).toBeVisible();
    await expect(page.getByText("+ # Suggested heading")).toBeVisible();

    // Accepting applies the hunk back into the document.
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(editor).toContainText("Suggested heading");
    await expect(page.getByText("Applied")).toBeVisible();
  });
});
