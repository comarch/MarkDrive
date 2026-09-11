import { describe, expect, it } from "vitest";
import {
  applyTableAction,
  findTableBlock,
  parseMarkdownTable,
  serializeMarkdownTable,
  tsvToMarkdownTable,
} from "../utils/tableUtils";

const TABLE = [
  "| Service | Storage |",
  "| ------- | ------- |",
  "| Drive   | Cloud   |",
  "| Local   | Browser |",
].join("\n");

describe("parseMarkdownTable and serializeMarkdownTable", () => {
  it("round-trips a table with aligned padding", () => {
    const model = parseMarkdownTable(TABLE.split("\n"));
    expect(model?.header).toEqual(["Service", "Storage"]);
    expect(model?.rows).toHaveLength(2);
    expect(serializeMarkdownTable(model!)).toEqual(TABLE.split("\n"));
  });

  it("rejects non-table lines", () => {
    expect(parseMarkdownTable(["just text", "more text"])).toBeNull();
  });
});

describe("findTableBlock", () => {
  it("finds the contiguous table around the cursor line", () => {
    const lines = ["Intro", ...TABLE.split("\n"), "Outro"];
    const block = findTableBlock(lines, 4);

    expect(block?.startLine).toBe(2);
    expect(block?.endLine).toBe(5);
    expect(block?.model.rows).toHaveLength(2);
  });
});

describe("applyTableAction", () => {
  it("inserts and removes rows", () => {
    const withRow = applyTableAction(TABLE, 3, { kind: "insert-row" });
    expect(withRow.split("\n")).toHaveLength(5);
    expect(withRow.split("\n")[4]).toMatch(/^\| +\| +\|$/);

    const withoutRow = applyTableAction(withRow, 3, { kind: "remove-row" });
    expect(withoutRow).toBe(TABLE);
  });

  it("inserts and removes columns at the cursor column", () => {
    const withColumn = applyTableAction(TABLE, 3, {
      kind: "insert-column",
      columnIndex: 1,
    });
    expect(withColumn).toContain("New column");
    expect(withColumn.split("\n")[0]).toContain(
      "| Service | New column | Storage |",
    );

    const withoutColumn = applyTableAction(withColumn, 3, {
      kind: "remove-column",
      columnIndex: 1,
    });
    expect(withoutColumn).toBe(TABLE);
  });

  it("aligns one column and keeps the rest", () => {
    const aligned = applyTableAction(TABLE, 3, {
      kind: "align-column",
      columnIndex: 1,
      align: "center",
    });
    expect(aligned).toContain("| ------- | :-----: |");
  });

  it("sorts rows by the cursor column", () => {
    const sorted = applyTableAction(TABLE, 3, {
      kind: "sort-column",
      columnIndex: 0,
      descending: true,
    });
    expect(sorted.split("\n")[2]).toContain("Local");
    expect(sorted.split("\n")[3]).toContain("Drive");
  });

  it("leaves non-table cursors untouched", () => {
    expect(applyTableAction(TABLE, 99, { kind: "insert-row" })).toBe(TABLE);
  });
});

describe("tsvToMarkdownTable", () => {
  it("converts tab-separated rows into an aligned table", () => {
    const tsv = "Service\tStorage\nDrive\tCloud\nLocal\tBrowser";
    const table = tsvToMarkdownTable(tsv);

    expect(table).toBe(TABLE);
  });

  it("pads ragged rows to the widest row", () => {
    const tsv = "A\tB\n1";
    const table = tsvToMarkdownTable(tsv);

    expect(table).toContain("| 1   |     |");
  });

  it("returns null for non-tabular text", () => {
    expect(tsvToMarkdownTable("plain text\nsecond line")).toBeNull();
    expect(tsvToMarkdownTable("only\theader")).toBeNull();
  });
});
