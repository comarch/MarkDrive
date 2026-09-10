import { describe, expect, it } from "vitest";
import {
  buildDocx,
  buildDocumentParts,
  buildZip,
  markdownToDocxModel,
} from "../utils/docx";

const SAMPLE = `# Title

A **bold** and *italic* text with \`code\` and a [link](https://external.example/page).

- first
- second
  - nested

1. one
2. two

| A | B |
| - | - |
| 1 | 2 |

- [x] done
- [ ] todo

\`\`\`js
const answer = 42;
\`\`\`

---

Trailing paragraph.
`;

describe("docx zip writer", () => {
  it("packs stored entries with valid headers", () => {
    const bytes = buildZip([
      { name: "a.txt", data: new TextEncoder().encode("hello") },
      { name: "b.txt", data: new TextEncoder().encode("world") },
    ]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("a.txt");
    expect(text).toContain("b.txt");
    // End of central directory signature sits 22 bytes from the end.
    const end = bytes.length - 22;
    expect(bytes[end]).toBe(0x50);
    expect(bytes[end + 1]).toBe(0x4b);
    expect(bytes[end + 2]).toBe(0x05);
    expect(bytes[end + 3]).toBe(0x06);
    // The directory pointers resolve: EOCD -> central header -> local.
    const view = new DataView(bytes.buffer);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    const localOffset = view.getUint32(centralOffset + 42, true);
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
  });

  it("is deterministic for identical input", () => {
    const one = buildZip([{ name: "x", data: new Uint8Array([1, 2, 3]) }]);
    const two = buildZip([{ name: "x", data: new Uint8Array([1, 2, 3]) }]);
    expect(Array.from(one)).toEqual(Array.from(two));
  });
});

describe("docx model", () => {
  it("maps headings, emphasis, code, and links", () => {
    const model = markdownToDocxModel(SAMPLE);
    const heading = model.paragraphs[0];
    expect(heading?.style).toBe("Heading1");
    expect(heading?.runs[0]?.text).toBe("Title");

    const paragraph = model.paragraphs.find((entry) =>
      entry.runs.some((run) => run.text.includes("bold")),
    );
    expect(paragraph?.runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "bold", bold: true }),
        expect.objectContaining({ text: "italic", italic: true }),
        expect.objectContaining({ text: "code", code: true }),
      ]),
    );
    // The link run points at a registered relationship.
    const linkRun = paragraph?.runs.find((run) => run.linkId);
    expect(linkRun?.text).toBe("link");
    expect(model.hyperlinks).toEqual([
      {
        id: expect.stringMatching(/^rId/),
        target: "https://external.example/page",
      },
    ]);
  });

  it("renders list bullets, numbering, nesting, and tasks", () => {
    const model = markdownToDocxModel(SAMPLE);
    expect(
      model.paragraphs.find((entry) =>
        entry.runs.some((r) => r.text === "first"),
      ),
    ).toMatchObject({ bullet: "\u2022", indent: 0 });
    expect(
      model.paragraphs.find((entry) =>
        entry.runs.some((r) => r.text === "nested"),
      ),
    ).toMatchObject({ bullet: "\u2022", indent: 1 });
    expect(
      model.paragraphs.find((entry) =>
        entry.runs.some((r) => r.text === "one"),
      ),
    ).toMatchObject({ bullet: "1." });
    expect(
      model.paragraphs.find((entry) =>
        entry.runs.some((r) => r.text === "two"),
      ),
    ).toMatchObject({ bullet: "2." });
    // Task checkboxes become their Unicode glyphs.
    expect(
      model.paragraphs.find((entry) =>
        entry.runs.some((r) => r.text === "\u2611 "),
      ),
    ).toBeTruthy();
    expect(
      model.paragraphs.find((entry) =>
        entry.runs.some((r) => r.text === "\u2610 "),
      ),
    ).toBeTruthy();
  });

  it("keeps fenced code and horizontal rules", () => {
    const model = markdownToDocxModel(SAMPLE);
    const codeLine = model.paragraphs.find((entry) =>
      entry.runs.some((r) => r.text === "const answer = 42;"),
    );
    expect(codeLine).toMatchObject({ style: "Code" });
    expect(model.paragraphs.some((entry) => entry.border)).toBe(true);
  });

  it("collects tables with header and body rows", () => {
    const model = markdownToDocxModel(SAMPLE);
    expect(model.tables).toEqual([{ header: ["A", "B"], rows: [["1", "2"]] }]);
  });
});

describe("docx parts and archive", () => {
  it("serializes paragraphs, tables, and relationships", () => {
    const model = markdownToDocxModel(SAMPLE);
    const { document, documentRels } = buildDocumentParts(model);
    expect(document).toContain('<w:pStyle w:val="Heading1"/>');
    expect(document).toContain("<w:b/>");
    expect(document).toContain("<w:i/>");
    expect(document).toContain("<w:tbl>");
    expect(document).toContain('r:id="rId1"');
    expect(documentRels).toContain(
      'Target="https://external.example/page" TargetMode="External"',
    );
  });

  it("escapes XML in text and attribute content", () => {
    const model = markdownToDocxModel(
      'R&D <tag> "quoted" [x](https://a.invalid/?q=1&r=2)',
    );
    const { document, documentRels } = buildDocumentParts(model);
    expect(document).toContain("R&amp;D &lt;tag&gt; &quot;quoted&quot;");
    expect(documentRels).toContain("q=1&amp;r=2");
  });

  it("assembles the full archive with every required part", () => {
    const bytes = buildDocx(SAMPLE);
    const text = new TextDecoder().decode(bytes);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
      "word/document.xml",
    ]) {
      expect(text).toContain(part);
    }
  });
});
