// Authoring quality checks in the style of markdownlint, reduced to
// rules that are cheap, purely local, and never guess style
// preferences. External link checking stays out: it would need
// outbound requests the app does not make.

export type LintSeverity = "error" | "warning";

export interface LintDiagnostic {
  rule: string;
  line: number;
  message: string;
  severity: LintSeverity;
}

const HEADING_PATTERN = /^(#{1,6})[ \t]+(\S.*)$/;
const MAX_HEADING_JUMP = 1;

/**
 * Runs all quality rules over a document. Lines are 1-based, matching
 * the editor gutter and the preview anchors.
 */
export function lintMarkdown(markdown: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const lines = markdown.split("\n");
  const seenHeadings = new Set<string>();
  let previousLevel = 0;
  let h1Count = 0;
  let fenceMarker: string | null = null;

  // Heading rules, kept separate so the line walk stays flat.
  const checkHeading = (line: string, lineNumber: number): void => {
    const headingMatch = HEADING_PATTERN.exec(line);
    if (!headingMatch) return;
    const [, hashes, text] = headingMatch;
    const level = (hashes ?? "").length;
    const title = (text ?? "").trim();

    if (level === 1) {
      h1Count += 1;
      if (h1Count > 1) {
        diagnostics.push({
          rule: "single-h1",
          line: lineNumber,
          message: "Documents should have only one top-level heading",
          severity: "warning",
        });
      }
    }

    if (previousLevel > 0 && level > previousLevel + MAX_HEADING_JUMP) {
      diagnostics.push({
        rule: "heading-increment",
        line: lineNumber,
        message: `Heading level jumps from ${previousLevel} to ${level}`,
        severity: "warning",
      });
    }
    if (previousLevel > 0 || level === 1) previousLevel = level;

    const key = `${level}:${title.toLowerCase()}`;
    if (title.length > 0 && seenHeadings.has(key)) {
      diagnostics.push({
        rule: "duplicate-heading",
        line: lineNumber,
        message: `Duplicate heading "${title}" at the same level`,
        severity: "warning",
      });
    } else {
      seenHeadings.add(key);
    }
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trimStart();

    // Track fences: headings inside code are examples, not structure.
    if (fenceMarker === null) {
      if (/^(```|~~~)/.test(trimmedLine)) {
        fenceMarker = trimmedLine.slice(0, 3);
        return;
      }
    } else {
      if (trimmedLine.startsWith(fenceMarker)) fenceMarker = null;
      return;
    }

    checkHeading(line, lineNumber);

    if (line.trimEnd() !== line) {
      diagnostics.push({
        rule: "trailing-spaces",
        line: lineNumber,
        message: "Line ends with whitespace",
        severity: "error",
      });
    }
  });

  // An unterminated fence is reported at the end of the document.
  if (fenceMarker !== null) {
    diagnostics.push({
      rule: "unbalanced-fence",
      line: lines.length,
      message: "Code fence is never closed",
      severity: "error",
    });
  }

  return diagnostics.sort((a, b) => a.line - b.line);
}

/**
 * Syntax-level link checks: empty link text and destinations that
 * cannot resolve. Targets inside the current folder validate through
 * the folder link graph; this catches broken syntax while writing.
 */
export function lintLinks(markdown: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  let fenceMarker: string | null = null;

  markdown.split("\n").forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trimStart();
    if (fenceMarker === null) {
      if (/^(```|~~~)/.test(trimmed)) {
        fenceMarker = trimmed.slice(0, 3);
        return;
      }
    } else {
      if (trimmed.startsWith(fenceMarker)) fenceMarker = null;
      return;
    }

    for (const match of line.matchAll(
      /\[([^\]]{0,400})\]\(([^)]{0,2000})\)/g,
    )) {
      const text = match[1] ?? "";
      const href = (match[2] ?? "").trim();
      if (text.trim().length === 0) {
        diagnostics.push({
          rule: "empty-link-text",
          line: lineNumber,
          message: "Link has no text",
          severity: "warning",
        });
      }
      if (href.length === 0) {
        diagnostics.push({
          rule: "empty-link-target",
          line: lineNumber,
          message: "Link has no destination",
          severity: "error",
        });
      }
    }
  });

  return diagnostics;
}
