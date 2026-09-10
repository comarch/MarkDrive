export type ColumnAlignment = "none" | "left" | "center" | "right";

export interface TableModel {
  header: string[];
  aligns: ColumnAlignment[];
  rows: string[][];
}

export type TableAction =
  | { kind: "insert-row" }
  | { kind: "remove-row" }
  | { kind: "insert-column"; columnIndex: number }
  | { kind: "remove-column"; columnIndex: number }
  | { kind: "align-column"; columnIndex: number; align: ColumnAlignment }
  | { kind: "sort-column"; columnIndex: number; descending: boolean };

function splitRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparator(line: string): boolean {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

function separatorFor(aligns: ColumnAlignment[], widths: number[]): string {
  const cells = aligns.map((align, index) => {
    const width = Math.max(widths[index] ?? 3, 3);
    switch (align) {
      case "left":
        return ":" + "-".repeat(width - 1);
      case "center":
        return ":" + "-".repeat(Math.max(width - 2, 1)) + ":";
      case "right":
        return "-".repeat(width - 1) + ":";
      default:
        return "-".repeat(width);
    }
  });
  return `| ${cells.join(" | ")} |`;
}

/** Pads cells so every row matches the table width. */
function padRow(cells: string[], width: number): string[] {
  const padded = cells.slice(0, width);
  while (padded.length < width) padded.push("");
  return padded;
}

/** Pads every cell so pipes line up; untouched cells keep their text. */
export function serializeMarkdownTable(model: TableModel): string[] {
  const width = Math.max(
    model.header.length,
    ...model.rows.map((row) => row.length),
    model.aligns.length,
  );
  const header = padRow(model.header, width);
  const rows = model.rows.map((row) => padRow(row, width));
  const columns = Array.from({ length: width }, (_, index) => {
    const cells = [header[index] ?? "", ...rows.map((row) => row[index] ?? "")];
    return Math.max(...cells.map((cell) => cell.length), 3);
  });
  const line = (cells: string[]): string =>
    `| ${cells.map((cell, index) => cell.padEnd(columns[index] ?? 3)).join(" | ")} |`;

  return [
    line(header),
    separatorFor(model.aligns, columns),
    ...rows.map((row) => line(row)),
  ];
}

export function parseMarkdownTable(lines: string[]): TableModel | null {
  if (lines.length < 2) return null;
  if (!lines[0]?.includes("|")) return null;
  if (!isSeparator(lines[1] ?? "")) return null;

  const header = splitRow(lines[0] ?? "");
  const aligns: ColumnAlignment[] = splitRow(lines[1] ?? "").map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (left) return "left";
    if (right) return "right";
    return "none";
  });
  const rows = lines.slice(2).map(splitRow);
  if (rows.some((row) => row.length !== header.length)) return null;

  return { header, aligns, rows };
}

/** Finds the contiguous table block around a line, 1-based, or null. */
export function findTableBlock(
  lines: string[],
  lineNumber: number,
): { startLine: number; endLine: number; model: TableModel } | null {
  const index = lineNumber - 1;
  const current = lines[index];
  if (!current || !current.includes("|")) return null;

  let start = index;
  while (start > 0 && lines[start - 1]?.includes("|")) start -= 1;
  let end = index;
  while (end + 1 < lines.length && lines[end + 1]?.includes("|")) end += 1;

  const block = lines.slice(start, end + 1);
  const model = parseMarkdownTable(block);
  if (!model) return null;
  return { startLine: start + 1, endLine: end + 1, model };
}

export function applyTableAction(
  markdown: string,
  cursorLine: number,
  action: TableAction,
): string {
  const lines = markdown.split("\n");
  const block = findTableBlock(lines, cursorLine);
  if (!block) return markdown;

  const { startLine, endLine, model } = block;
  const next: TableModel = {
    header: [...model.header],
    aligns: [...model.aligns],
    rows: model.rows.map((row) => [...row]),
  };
  const clamp = (index: number): number =>
    Math.min(Math.max(0, index), next.header.length - 1);

  switch (action.kind) {
    case "insert-row":
      next.rows.push(next.header.map(() => ""));
      break;
    case "remove-row":
      if (next.rows.length === 0) return markdown;
      next.rows.pop();
      break;
    case "insert-column": {
      const at = clamp(action.columnIndex);
      next.header.splice(at, 0, "New column");
      next.aligns.splice(at, 0, "none");
      next.rows = next.rows.map((row) => {
        const copy = [...row];
        copy.splice(at, 0, "");
        return copy;
      });
      break;
    }
    case "remove-column": {
      if (next.header.length <= 1) return markdown;
      const at = clamp(action.columnIndex);
      next.header.splice(at, 1);
      next.aligns.splice(at, 1);
      next.rows = next.rows.map((row) => {
        const copy = [...row];
        copy.splice(at, 1);
        return copy;
      });
      break;
    }
    case "align-column": {
      const at = clamp(action.columnIndex);
      next.aligns[at] = action.align;
      break;
    }
    case "sort-column": {
      const at = clamp(action.columnIndex);
      next.rows.sort((a, b) => {
        const left = a[at] ?? "";
        const right = b[at] ?? "";
        const order = left.localeCompare(right, undefined, { numeric: true });
        return action.descending ? -order : order;
      });
      break;
    }
  }

  return spliceTable(markdown, lines, startLine, endLine, next);
}

function spliceTable(
  markdown: string,
  lines: string[],
  startLine: number,
  endLine: number,
  model: TableModel,
): string {
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  const rebuilt = [...before, ...serializeMarkdownTable(model), ...after];
  const joined = rebuilt.join("\n");
  return joined === markdown ? markdown : joined;
}

/**
 * Converts tab-separated clipboard content, as copied from Sheets or Excel,
 * into an aligned Markdown table. Returns null for non-tabular text.
 */
export function tsvToMarkdownTable(text: string): string | null {
  const rows = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line, index, all) => line.length > 0 || index < all.length - 1);
  if (rows.length < 2) return null;
  if (!rows.some((row) => row.includes("\t"))) return null;
  const width = Math.max(...rows.map((row) => row.split("\t").length));

  const model: TableModel = {
    header: padRow(rows[0]?.split("\t") ?? [], width),
    aligns: Array.from({ length: width }, () => "none" as const),
    rows: rows
      .slice(1)
      .filter((row) => row.length > 0)
      .map((row) => padRow(row.split("\t"), width)),
  };
  if (model.rows.length === 0) return null;
  return serializeMarkdownTable(model).join("\n");
}
