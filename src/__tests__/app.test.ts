import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  injectCommentHighlights,
} from "../components/Preview/markdownParser";
import { extractOutline } from "../components/Preview/MarkdownPreview";
import { parseDriveStateFromUrl } from "../services/driveState";
import { DriveComment } from "../types/drive";

describe("markdownParser", () => {
  it("renders standard markdown elements to html", () => {
    const md = "# Title\n\n**bold** and *italic*";
    const html = parseMarkdown(md);
    expect(html).toContain("<h1");
    expect(html).toContain("Title");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders task lists with checkboxes", () => {
    const md = "- [x] Done\n- [ ] Todo";
    const html = parseMarkdown(md);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("marks relative links as cross-document links", () => {
    const md =
      "[Notes](notes.md), [External](https://external.example), [Local](#section), [Mail](mailto:a@b.c)";
    const html = parseMarkdown(md);

    expect(html).toContain('data-doc-link="notes.md"');
    expect(html).not.toContain('data-doc-link="https://external.example');
    expect(html).not.toContain('data-doc-link="#section"');
    expect(html).not.toContain('data-doc-link="mailto:a@b.c"');
  });

  it("renders tables", () => {
    const md = "| Col 1 | Col 2 |\n| --- | --- |\n| Val 1 | Val 2 |";
    const html = parseMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Col 1</th>");
    expect(html).toContain("<td>Val 1</td>");
  });

  it("renders KaTeX formulas", () => {
    const md = "Formula: $E = mc^2$ and $$\\sum_{i=1}^n i$$";
    const html = parseMarkdown(md);
    expect(html).toContain("katex");
  });

  it("renders Mermaid diagram blocks", () => {
    const md = "```mermaid\ngraph TD;\nA-->B;\n```";
    const html = parseMarkdown(md);
    expect(html).toContain('<div class="mermaid">');
  });

  it("escapes raw html from markdown", () => {
    const html = parseMarkdown(
      '<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain('<img src="x"');
  });

  it("escapes comment metadata in highlight attributes", () => {
    const html = injectCommentHighlights("<p>review this text</p>", [
      {
        id: 'comment" onclick="alert(1)',
        kind: "drive#comment",
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        author: {
          displayName: 'Reviewer" onmouseover="alert(1)',
          emailAddress: "reviewer@example.invalid",
        },
        content: 'Check this"><img src=x onerror=alert(1)>',
        htmlContent: "",
        quotedFileContent: { value: "review this text" },
      },
    ]);

    expect(html).not.toContain('onclick="alert(1)"');
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).not.toContain("<img");
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;img");
  });

  it("injects comment highlights into html", () => {
    const html = "<p>This is important text to review.</p>";
    const comments: DriveComment[] = [
      {
        id: "c1",
        kind: "drive#comment",
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        author: { displayName: "Jan", emailAddress: "jan@example.invalid" },
        content: "Check this",
        htmlContent: "Check this",
        quotedFileContent: { value: "important text" },
      },
    ];

    const result = injectCommentHighlights(html, comments);
    expect(result).toContain(
      '<mark class="comment-highlight active" data-comment-id="c1"',
    );
    expect(result).toContain("important text</mark>");
  });
});

describe("extractOutline", () => {
  it("extracts headings hierarchy from markdown", () => {
    const md = "# Header 1\n\nSome text\n\n## Subheader 2\n\n### Sub-sub 3";
    const outline = extractOutline(md);
    expect(outline).toHaveLength(3);
    expect(outline[0]).toEqual({
      id: "header-1",
      text: "Header 1",
      level: 1,
      line: 1,
    });
    expect(outline[1]?.level).toBe(2);
    expect(outline[2]?.level).toBe(3);
  });
});

describe("driveState", () => {
  it("parses direct query parameters", () => {
    const state = parseDriveStateFromUrl("?fileId=12345");
    expect(state).toEqual({
      action: "open",
      ids: ["12345"],
    });
  });

  it("parses json state parameter from Google Drive", () => {
    const driveJson = JSON.stringify({
      action: "create",
      folderId: "folder_abc",
      userId: "user_123",
    });
    const state = parseDriveStateFromUrl(
      `?state=${encodeURIComponent(driveJson)}`,
    );
    expect(state?.action).toBe("create");
    expect(state?.folderId).toBe("folder_abc");
    expect(state?.userId).toBe("user_123");
  });

  it("rejects malformed Drive state values", () => {
    expect(
      parseDriveStateFromUrl(
        `?state=${encodeURIComponent(
          JSON.stringify({ action: "delete", ids: ["file_123"] }),
        )}`,
      ),
    ).toBeNull();
    expect(
      parseDriveStateFromUrl(
        `?state=${encodeURIComponent(
          JSON.stringify({ action: "open", ids: ["../../secret"] }),
        )}`,
      ),
    ).toBeNull();
    expect(parseDriveStateFromUrl("?fileId=%3Cscript%3E")).toBeNull();
  });
});
