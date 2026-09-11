import { describe, expect, it } from "vitest";
import { lintLinks, lintMarkdown } from "../services/lint";

describe("lintMarkdown", () => {
  it("flags heading level jumps and duplicate headings", () => {
    const doc = [
      "# Title",
      "",
      "### Deep jump",
      "",
      "## Section",
      "",
      "## Section",
    ].join("\n");
    const diagnostics = lintMarkdown(doc);

    expect(diagnostics.map((d) => d.rule)).toEqual([
      "heading-increment",
      "duplicate-heading",
    ]);
    expect(diagnostics[0]?.line).toBe(3);
    expect(diagnostics[1]?.line).toBe(7);
  });

  it("flags trailing whitespace and unterminated fences", () => {
    const doc = "# Title\n\ntrail \n\n```ts\nconst x = 1;";
    const diagnostics = lintMarkdown(doc);

    expect(diagnostics.map((d) => d.rule)).toEqual([
      "trailing-spaces",
      "unbalanced-fence",
    ]);
    expect(diagnostics[0]?.severity).toBe("error");
  });

  it("flags a second top-level heading", () => {
    const doc = "# One\n\n## Two\n\n# Three";
    const rules = lintMarkdown(doc).map((d) => d.rule);
    expect(rules).toContain("single-h1");
  });

  it("ignores headings and examples inside fences", () => {
    const doc = "# Title\n\n```md\n### Jump\n## Dup\n## Dup\n```\n";
    expect(lintMarkdown(doc)).toEqual([]);
  });

  it("returns nothing for clean documents", () => {
    expect(lintMarkdown("# Title\n\n## Section\n\ntext\n")).toEqual([]);
  });
});

describe("lintLinks", () => {
  it("flags empty link text and empty destinations", () => {
    const doc = "[empty]() and [](target)";
    const diagnostics = lintLinks(doc);

    expect(diagnostics.map((d) => d.rule).sort()).toEqual([
      "empty-link-target",
      "empty-link-text",
    ]);
  });

  it("leaves healthy links and fenced examples alone", () => {
    const doc = "[good](notes.md)\n\n```md\n[](example)\n```";
    expect(lintLinks(doc)).toEqual([]);
  });
});
