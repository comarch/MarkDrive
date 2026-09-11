import { describe, expect, it } from "vitest";
import {
  frontmatterLineOffset,
  parseFrontmatter,
  serializeFrontmatter,
  updateFrontmatterField,
} from "../utils/frontmatter";

describe("parseFrontmatter", () => {
  it("splits a leading block into raw, body, and fields", () => {
    const markdown = "---\ntitle: Notes\nauthor: Wojtek\n---\n\n# Heading\n";
    const result = parseFrontmatter(markdown);

    expect(result.raw).toBe("---\ntitle: Notes\nauthor: Wojtek\n---\n");
    expect(result.body).toBe("\n# Heading\n");
    expect(result.fields).toEqual({ title: "Notes", author: "Wojtek" });
  });

  it("returns the full text when no block exists", () => {
    const markdown = "# Just a heading\n";
    const result = parseFrontmatter(markdown);

    expect(result.raw).toBe("");
    expect(result.body).toBe(markdown);
    expect(result.fields).toEqual({});
  });

  it("keeps malformed YAML as raw text with empty fields", () => {
    const markdown = "---\ntitle: [unclosed\n---\n\nBody\n";
    const result = parseFrontmatter(markdown);

    expect(result.raw).toContain("unclosed");
    expect(result.fields).toEqual({});
    expect(result.body).toBe("\nBody\n");
  });

  it("ignores a horizontal rule that only looks like frontmatter", () => {
    const markdown = "Intro\n\n---\n\ntitle: not frontmatter\n";
    const result = parseFrontmatter(markdown);

    expect(result.raw).toBe("");
    expect(result.body).toBe(markdown);
  });
});

describe("frontmatterLineOffset", () => {
  it("counts the lines the block occupies", () => {
    expect(frontmatterLineOffset("---\ntitle: Notes\n---\n\nBody")).toBe(3);
    expect(frontmatterLineOffset("Body only")).toBe(0);
  });
});

describe("serializeFrontmatter and updateFrontmatterField", () => {
  it("round-trips untouched text byte for byte", () => {
    const markdown = "---\ntitle: Notes\n---\n\n# Heading\n";
    const { raw, body, fields } = parseFrontmatter(markdown);

    // The raw block is preserved verbatim when nothing is edited, and a
    // no-op update through the panel still yields the same content.
    expect(raw).toBe("---\ntitle: Notes\n---\n");
    expect(serializeFrontmatter(fields) + body).toBe(
      "---\ntitle: Notes\n---\n\n# Heading\n",
    );
    expect(updateFrontmatterField(markdown, "title", "Notes")).toBe(
      `---\ntitle: Notes\n---\n\n# Heading\n`,
    );
  });

  it("updates one field and preserves the rest and the body", () => {
    const markdown = "---\ntitle: Notes\nstatus: draft\n---\n\n# Heading\n";
    const updated = updateFrontmatterField(markdown, "status", "reviewed");

    expect(updated).toContain("status: reviewed");
    expect(updated).toContain("title: Notes");
    expect(updated.endsWith("\n# Heading\n")).toBe(true);
  });

  it("adds a new key and creates a block when none exists", () => {
    expect(updateFrontmatterField("# Heading\n", "title", "Notes")).toBe(
      "---\ntitle: Notes\n---\n# Heading\n",
    );
  });

  it("ignores empty keys", () => {
    const markdown = "---\ntitle: Notes\n---\n\n# Heading\n";
    expect(updateFrontmatterField(markdown, "  ", "value")).toBe(markdown);
  });
});
