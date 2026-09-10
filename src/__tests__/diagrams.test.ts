import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../components/Preview/markdownParser";

describe("KaTeX macros and equation numbers", () => {
  it("expands frontmatter macros in display and inline math", () => {
    const html = parseMarkdown(
      [
        "---",
        "math-macros:",
        '  RR: "\\\\mathbb{R}"',
        "---",
        "",
        "$$x \\in \\RR$$",
        "",
        "Inline $a \\in \\RR$ too.",
      ].join("\n"),
    );

    // The macro expands to mathbb styling in both places.
    expect(html.match(/mathbb/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("numbers display equations sequentially", () => {
    const html = parseMarkdown("$$a+b$$\n\ntext\n\n$$c+d$$");
    expect(html).toContain('<span class="equation-number">(1)</span>');
    expect(html).toContain('<span class="equation-number">(2)</span>');
  });

  it("ignores non-string macro values", () => {
    const html = parseMarkdown(
      "---\nmath-macros:\n  bad: [1, 2]\n---\n\n$$x$$",
    );
    expect(html).toContain("katex-display");
  });
});

describe("diagram blocks", () => {
  it("emits graphviz sources for the preview to render", () => {
    const html = parseMarkdown("```dot\ndigraph { a -> b }\n```");
    expect(html).toContain('class="graphviz-src"');
    expect(html).toContain("digraph { a -&gt; b }");
  });

  it("accepts graphviz as an alias language", () => {
    const html = parseMarkdown("```graphviz\nA -> B\n```");
    expect(html).toContain('class="graphviz-src"');
  });

  it("emits excalidraw scenes as embed placeholders", () => {
    const scene = JSON.stringify({ elements: [], appState: {} });
    const html = parseMarkdown("```excalidraw\n" + scene + "\n```");
    expect(html).toContain('class="excalidraw-embed"');
    expect(html).not.toContain("<script");
  });

  it("keeps mermaid blocks on their existing path", () => {
    const html = parseMarkdown("```mermaid\ngraph TD\n```");
    expect(html).toContain('class="mermaid"');
  });
});
