import { expect, test } from "@playwright/test";

test.describe("wikilinks and link graph", () => {
  test("renders wikilinks in the preview and opens the graph modal", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "gdrive_md_last_content",
        [
          "# Wiki demo",
          "",
          "See [[Meeting Notes]] and [[Glossary|the glossary]].",
          "",
          "```md",
          "[[Not a link]]",
          "```",
          "",
        ].join("\n"),
      );
    });
    await page.goto("/");

    // Wikilinks render as resolvable anchors in the preview.
    const meetingLink = page.locator("a[data-wikilink='Meeting Notes']");
    await expect(meetingLink).toBeVisible();
    await expect(meetingLink).toHaveText("Meeting Notes");
    await expect(page.locator("a[data-wikilink='Glossary']")).toHaveText(
      "the glossary",
    );

    // Fenced examples stay plain code.
    const codeBlock = page.locator("pre code");
    await expect(codeBlock).toContainText("[[Not a link]]");

    // Clicking a wikilink without a Drive folder explains the limit.
    const dialogMessage = page.waitForEvent("dialog").then((dialog) => {
      const message = dialog.message();
      void dialog.dismiss();
      return message;
    });
    await meetingLink.click();
    expect(await dialogMessage).toContain("Drive folder");

    // The graph modal shows the same honest empty state in demo mode.
    await page.getByTitle("Folder link graph").click();
    await expect(
      page.getByText("The link graph needs a Drive folder."),
    ).toBeVisible();
  });
});
