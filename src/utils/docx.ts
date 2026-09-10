import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { Token } from "markdown-it";

// DOCX export built from the markdown-it token stream. The ZIP writer is
// hand-rolled (stored entries, no compression, fixed timestamps) so the
// supply chain gains no document-generation dependency and the output is
// deterministic for reproducible artifacts.

const docxMd = new MarkdownIt({ html: false, linkify: false }).use(taskLists);

const MONO_FONT = "Consolas";

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// ---- Minimal deterministic ZIP (stored, no compression) ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) {
    const tableEntry = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = tableEntry ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = (value: number) =>
  new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
const u32 = (value: number) =>
  new Uint8Array([
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

/** Builds a stored (uncompressed) ZIP archive deterministically. */
export const buildZip = (
  entries: Array<{ name: string; data: Uint8Array }>,
): Uint8Array => {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    locals.push(
      concat([
        u32(0x04034b50), // local file header signature
        u16(20), // version needed
        u16(0), // flags
        u16(0), // method: stored
        u16(0), // time 00:00
        u16(0x21), // date 1980-01-01
        u32(crc),
        u32(entry.data.length), // compressed size
        u32(entry.data.length), // uncompressed size
        u16(nameBytes.length),
        u16(0), // extra length
        nameBytes,
        entry.data,
      ]),
    );
    centrals.push(
      concat([
        u32(0x02014b50), // central directory header signature
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0x21),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]),
    );
    // Local header is 30 fixed bytes plus name and data; that length
    // gives the next entry's offset for the central directory.
    offset += 30 + nameBytes.length + entry.data.length;
  }
  return concat([
    ...locals,
    ...centrals,
    concat([
      u32(0x06054b50), // end of central directory signature
      u16(0),
      u16(0),
      u16(entries.length),
      u16(entries.length),
      u32(centrals.reduce((sum, part) => sum + part.length, 0)),
      u32(offset),
      u16(0),
    ]),
  ]);
};

// ---- WordprocessingML model ----

interface DocxRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  /** Set for hyperlink runs; the id maps into document.xml.rels. */
  linkId?: string;
}

interface DocxParagraph {
  style?: string;
  bullet?: string;
  indent?: number;
  border?: boolean;
  runs: DocxRun[];
}

interface DocxTable {
  header: string[];
  rows: string[][];
}

interface DocxModel {
  paragraphs: DocxParagraph[];
  tables: DocxTable[];
  hyperlinks: Array<{ id: string; target: string }>;
}

// Walks inline child tokens into styled runs. Task checkboxes become
// their Unicode glyphs; images keep their alt text in italics.
const inlineRuns = (
  children: Token[],
  hyperlinks: Array<{ id: string; target: string }>,
): DocxRun[] => {
  const runs: DocxRun[] = [];
  let bold = false;
  let italic = false;
  let strike = false;
  let linkId: string | undefined;
  for (const token of children) {
    switch (token.type) {
      case "text":
        runs.push({ text: token.content, bold, italic, strike, linkId });
        break;
      case "code_inline":
        runs.push({ text: token.content, code: true });
        break;
      case "strong_open":
        bold = true;
        break;
      case "strong_close":
        bold = false;
        break;
      case "em_open":
        italic = true;
        break;
      case "em_close":
        italic = false;
        break;
      case "s_open":
        strike = true;
        break;
      case "s_close":
        strike = false;
        break;
      case "link_open": {
        const id = `rId${hyperlinks.length + 1}`;
        hyperlinks.push({ id, target: token.attrGet("href") ?? "" });
        linkId = id;
        break;
      }
      case "link_close":
        linkId = undefined;
        break;
      case "html_inline":
        // markdown-it-task-lists injects a checkbox input; other raw
        // HTML does not survive the html:false parser.
        if (token.content.includes("task-list-item-checkbox")) {
          runs.push({
            text: token.content.includes("checked") ? "\u2611 " : "\u2610 ",
          });
        }
        break;
      case "image":
        runs.push({ text: token.content, italic: true });
        break;
      default:
        break;
    }
  }
  return runs;
};

const headingStyle = (tag: string): string | null => {
  const match = /^h([1-6])$/.exec(tag);
  return match ? `Heading${match[1]}` : null;
};

/**
 * Converts Markdown into the paragraph and table model that mirrors into
 * word/document.xml. Unknown constructs degrade to plain text runs.
 */
export const markdownToDocxModel = (markdown: string): DocxModel => {
  const model: DocxModel = { paragraphs: [], tables: [], hyperlinks: [] };
  const tokens = docxMd.parse(markdown, {});

  let pendingStyle: string | undefined;
  let pendingBullet: string | undefined;
  let pendingIndent: number | undefined;
  let pendingRuns: DocxRun[] | null = null;

  let listDepth = 0;
  let ordered = false;
  let orderedCounter = 0;

  // Table state machine.
  let tableHeader: string[] | null = null;
  let tableRows: string[][] | null = null;
  let currentRow: string[] | null = null;
  let currentCellRuns: DocxRun[] | null = null;

  const flush = () => {
    if (pendingRuns !== null) {
      model.paragraphs.push({
        style: pendingStyle,
        bullet: pendingBullet,
        indent: pendingIndent,
        runs: pendingRuns,
      });
    }
    pendingRuns = null;
    pendingStyle = undefined;
    pendingBullet = undefined;
    pendingIndent = undefined;
  };

  for (const token of tokens) {
    switch (token.type) {
      case "heading_open":
        pendingStyle = headingStyle(token.tag) ?? undefined;
        break;
      case "heading_close":
        flush();
        break;
      case "paragraph_close":
        flush();
        break;
      case "inline":
        if (currentCellRuns !== null) {
          currentCellRuns.push(
            ...inlineRuns(token.children ?? [], model.hyperlinks),
          );
        } else {
          const runs = inlineRuns(token.children ?? [], model.hyperlinks);
          if (pendingRuns === null) pendingRuns = [];
          pendingRuns.push(...runs);
        }
        break;
      case "bullet_list_open":
        listDepth += 1;
        ordered = false;
        orderedCounter = 0;
        break;
      case "ordered_list_open":
        listDepth += 1;
        ordered = true;
        orderedCounter = 0;
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        listDepth = Math.max(0, listDepth - 1);
        break;
      case "list_item_open":
        orderedCounter += 1;
        pendingBullet = ordered ? `${orderedCounter}.` : "\u2022";
        pendingIndent = Math.max(0, listDepth - 1);
        break;
      case "fence":
      case "code_block": {
        const body = token.content.replace(/\n$/, "");
        for (const line of body.split("\n")) {
          model.paragraphs.push({
            style: "Code",
            runs: [{ text: line, code: true }],
          });
        }
        break;
      }
      case "hr":
        model.paragraphs.push({ runs: [], border: true });
        break;
      case "table_open":
        tableHeader = null;
        tableRows = [];
        break;
      case "thead_open":
        tableHeader = [];
        currentRow = tableHeader;
        break;
      case "thead_close":
        currentRow = null;
        break;
      case "tbody_open":
        currentRow = null;
        break;
      case "tr_open":
        // tr_open starts the next row; header rows reuse the header
        // array, body rows get a fresh one.
        if (currentRow === tableHeader && tableHeader) {
          currentRow = tableHeader;
        } else if (tableRows) {
          currentRow = [];
          tableRows.push(currentRow);
        }
        break;
      case "tr_close":
        currentRow = null;
        break;
      case "th_open":
      case "td_open":
        currentCellRuns = [];
        break;
      case "th_close":
      case "td_close":
        if (currentCellRuns && currentRow) {
          currentRow.push(
            currentCellRuns
              .map((run) => run.text)
              .join("")
              .trim(),
          );
        }
        currentCellRuns = null;
        break;
      case "table_close":
        if (tableHeader && tableRows) {
          model.tables.push({ header: tableHeader, rows: tableRows });
        }
        tableHeader = null;
        tableRows = null;
        break;
      default:
        break;
    }
  }
  flush();
  return model;
};

// ---- Serialization ----

const runXml = (run: DocxRun): string => {
  const props: string[] = [];
  if (run.bold) props.push("<w:b/>");
  if (run.italic) props.push("<w:i/>");
  if (run.strike) props.push("<w:strike/>");
  if (run.code) {
    props.push(
      `<w:rFonts w:ascii="${MONO_FONT}" w:hAnsi="${MONO_FONT}"/>`,
      '<w:shd w:val="clear" w:color="auto" w:fill="F1F1F1"/>',
    );
  }
  const rPr = props.length > 0 ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  const preserve =
    run.text.startsWith(" ") || run.text.endsWith(" ")
      ? ' xml:space="preserve"'
      : "";
  return `<w:r>${rPr}<w:t${preserve}>${escapeXml(run.text)}</w:t></w:r>`;
};

const paragraphXml = (paragraph: DocxParagraph): string => {
  const pPr: string[] = [];
  if (paragraph.style) pPr.push(`<w:pStyle w:val="${paragraph.style}"/>`);
  if (paragraph.indent) {
    pPr.push(`<w:ind w:left="${paragraph.indent * 360}"/>`);
  }
  if (paragraph.border) {
    pPr.push(
      '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>',
    );
  }
  const bullet = paragraph.bullet
    ? runXml({ text: `${paragraph.bullet} ` })
    : "";
  const runs = paragraph.runs
    .map((run) =>
      run.linkId
        ? `<w:hyperlink r:id="${run.linkId}">${runXml({ ...run, linkId: undefined, italic: true })}</w:hyperlink>`
        : runXml(run),
    )
    .join("");
  return `<w:p>${
    pPr.length > 0 ? `<w:pPr>${pPr.join("")}</w:pPr>` : ""
  }${bullet}${runs}</w:p>`;
};

const tableXml = (table: DocxTable): string => {
  const cell = (text: string, bold: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p>${runXml({
      text,
      bold,
    })}</w:p></w:tc>`;
  const headerRow = `<w:tr>${table.header
    .map((text) => cell(text, true))
    .join("")}</w:tr>`;
  const bodyRows = table.rows
    .map(
      (row) => `<w:tr>${row.map((text) => cell(text, false)).join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="auto"/><w:left w:val="single" w:sz="4" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:color="auto"/><w:right w:val="single" w:sz="4" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:color="auto"/></w:tblBorders></w:tblPr>${headerRow}${bodyRows}</w:tbl>`;
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${[1, 2, 3, 4, 5, 6]
  .map(
    (level) => `<w:style w:type="paragraph" w:styleId="Heading${level}">
<w:name w:val="heading ${level}"/>
<w:pPr><w:outlineLvl w:val="${Math.min(level - 1, 8)}"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="${Math.max(28 - level * 2, 20)}"/></w:rPr>
</w:style>`,
  )
  .join("\n")}
<w:style w:type="paragraph" w:styleId="Code">
<w:name w:val="Code"/>
<w:rPr><w:rFonts w:ascii="${MONO_FONT}" w:hAnsi="${MONO_FONT}"/><w:sz w:val="20"/></w:rPr>
</w:style>
</w:styles>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** word/document.xml plus its relationships part. */
export const buildDocumentParts = (
  model: DocxModel,
): { document: string; documentRels: string } => {
  const body = [
    ...model.paragraphs.map(paragraphXml),
    ...model.tables.map(tableXml),
  ].join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const hyperlinkRels = model.hyperlinks
    .map(
      (link) =>
        `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(
          link.target,
        )}" TargetMode="External"/>`,
    )
    .join("");
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hyperlinkRels}</Relationships>`;
  return { document, documentRels };
};

/** Assembles the final .docx archive bytes. */
export const buildDocx = (markdown: string): Uint8Array => {
  const model = markdownToDocxModel(markdown);
  const { document, documentRels } = buildDocumentParts(model);
  const encode = (text: string) => new TextEncoder().encode(text);
  return buildZip([
    { name: "[Content_Types].xml", data: encode(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: encode(ROOT_RELS_XML) },
    { name: "word/_rels/document.xml.rels", data: encode(documentRels) },
    { name: "word/styles.xml", data: encode(STYLES_XML) },
    { name: "word/document.xml", data: encode(document) },
  ]);
};
