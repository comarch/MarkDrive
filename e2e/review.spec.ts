import { expect, test } from "@playwright/test";

test.describe("review workflow", () => {
  test("review status pill, mentions, and the review queue", async ({
    page,
  }) => {
    // Load a draft that already carries a review status in frontmatter.
    await page.addInitScript(() => {
      localStorage.setItem(
        "gdrive_md_last_content",
        "---\nreview-status: in-review\n---\n\n# Review demo\n\nBody text.\n",
      );
    });
    await page.goto("/");
    await expect(page.locator(".cm-content")).toContainText("Review demo");

    // The header pill reflects the frontmatter status.
    await expect(page.getByTitle("Review status: In review")).toBeVisible();

    // The review queue opens with an honest empty state in demo mode.
    await page.getByTitle("Documents awaiting review").click();
    await expect(page.getByText("No documents awaiting review.")).toBeVisible();
    await page.getByTitle("Close review queue").click();

    // A comment with a mention renders the mention highlighted.
    await page.getByTitle("Google Drive comments").click();
    await page.getByTitle("Add new comment").click();
    await page
      .getByPlaceholder("Type your comment here...")
      .fill("@anna please review the pricing section");
    await page.getByRole("button", { name: "Post Comment" }).click();
    await expect(
      page.locator("span", { hasText: "@anna" }).first(),
    ).toBeVisible();
  });
});
