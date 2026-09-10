import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../components/Preview/markdownParser";
import { findTaskListLines, toggleTaskLine } from "../utils/tasks";

describe("findTaskListLines", () => {
  it("finds task list items and skips regular items, headings, and fences", () => {
    const markdown = [
      "# Tasks",
      "",
      "- regular item",
      "- [ ] Bullet task",
      "  * [x] Indented task",
      "1. [X] Ordered task",
      "",
      "```text",
      "- [ ] Fenced task",
      "```",
      "",
      "+ [ ] Final task",
    ].join("\n");

    expect(findTaskListLines(markdown)).toEqual([4, 5, 6, 12]);
  });
});

describe("toggleTaskLine", () => {
  it("checks and unchecks a task while preserving the rest of the line", () => {
    const markdown = "  12) [ ] Keep  trailing text";
    const checked = toggleTaskLine(markdown, 1, true);

    expect(checked).toBe("  12) [x] Keep  trailing text");
    expect(toggleTaskLine(checked, 1, false)).toBe(markdown);
  });

  it("unchecks uppercase markers", () => {
    expect(toggleTaskLine("* [X] Done", 1, false)).toBe("* [ ] Done");
  });

  it("returns unchanged text for invalid or already requested states", () => {
    const markdown = "- [ ] Todo\nplain text";

    expect(toggleTaskLine(markdown, 1, false)).toBe(markdown);
    expect(toggleTaskLine("- [X] Done", 1, true)).toBe("- [X] Done");
    expect(toggleTaskLine(markdown, 2, true)).toBe(markdown);
    expect(toggleTaskLine(markdown, 0, true)).toBe(markdown);
    expect(toggleTaskLine(markdown, 3, true)).toBe(markdown);
  });

  it("does not toggle fenced task lines", () => {
    const markdown = "```\n- [ ] Fenced\n```";

    expect(toggleTaskLine(markdown, 2, true)).toBe(markdown);
  });

  it("skips tilde-fenced task lines like backtick fences", () => {
    const markdown = "~~~\n- [ ] Fenced\n~~~\n\n- [ ] Live";

    expect(findTaskListLines(markdown)).toEqual([5]);
    expect(toggleTaskLine(markdown, 2, true)).toBe(markdown);
  });

  it("finds and toggles blockquoted task list items", () => {
    const markdown = "> - [ ] Quoted task\n\n- [ ] Plain task";

    expect(findTaskListLines(markdown)).toEqual([1, 3]);
    expect(toggleTaskLine(markdown, 1, true)).toBe(
      "> - [x] Quoted task\n\n- [ ] Plain task",
    );
  });
});

describe("parseMarkdown task checkboxes", () => {
  it("annotates task inputs with source lines and keeps raw inputs disabled", () => {
    const html = parseMarkdown(
      '- [ ] One\n\n```text\n- [ ] ignored\n```\n\n- [x] Two\n\n<input type="checkbox">',
    );
    const taskInputs = html.match(
      /<input[^>]*class="[^"]*\btask-list-item-checkbox\b[^"]*"[^>]*>/g,
    );

    expect(taskInputs).toHaveLength(2);
    expect(taskInputs?.[0]).toContain('data-task-line="1"');
    expect(taskInputs?.[1]).toContain('data-task-line="7"');
    expect(taskInputs?.every((input) => !input.includes("disabled"))).toBe(
      true,
    );
    expect(html).toContain('<input type="checkbox" disabled="">');
  });

  it("annotates blockquote task checkboxes", () => {
    const html = parseMarkdown("> - [ ] Quoted task\n\n- [ ] Plain task");
    const taskInputs = html.match(
      /<input[^>]*class="[^"]*\btask-list-item-checkbox\b[^"]*"[^>]*>/g,
    );

    expect(taskInputs).toHaveLength(2);
    expect(taskInputs?.[0]).toContain('data-task-line="1"');
    expect(taskInputs?.[1]).toContain('data-task-line="3"');
  });

  it("leaves checkboxes inert when source lines and rendered inputs disagree", () => {
    // Four leading spaces make the first line a code block, so the renderer
    // shows one checkbox while the source scan finds two task lines.
    const html = parseMarkdown("    - [ ] Code block task\n\n- [ ] Real task");
    const taskInputs = html.match(
      /<input[^>]*class="[^"]*\btask-list-item-checkbox\b[^"]*"[^>]*>/g,
    );

    expect(taskInputs).toHaveLength(1);
    expect(taskInputs?.[0]).not.toContain("data-task-line");
  });
});
