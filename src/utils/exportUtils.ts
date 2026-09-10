import { parseMarkdown } from "../components/Preview/markdownParser";
import type { ExportStyles } from "./exportAssets";

/**
 * Downloads a file to user's computer
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports markdown text directly as a .md file
 */
export function exportAsMarkdown(filename: string, content: string) {
  const finalName = filename.endsWith(".md") ? filename : `${filename}.md`;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, finalName);
}

/**
 * Builds the self-contained HTML document. Styles are passed in so this
 * stays a pure function that unit tests can check without Vite asset
 * imports.
 */
export function buildHtmlDocument(
  filename: string,
  markdownContent: string,
  styles: ExportStyles,
): string {
  const renderedContent = parseMarkdown(markdownContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filename)}</title>
  <style>
${styles.highlightCss}
  </style>
  <style>
${styles.katexCss}
  </style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #24292f;
      background-color: #ffffff;
    }
    h1, h2, h3, h4 { color: #1f2328; margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
    th { background-color: #f6f8fa; }
    tr:nth-child(even) { background-color: #fbfcfd; }
    blockquote { border-left: 4px solid #0284c7; padding: 4px 16px; margin: 16px 0; color: #57606a; background: #f8fafc; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }
    code { font-family: monospace; font-size: 0.9em; }
    :not(pre) > code { background: #f1f5f9; color: #db2777; padding: 2px 6px; border-radius: 4px; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
  </style>
</head>
<body>
  ${renderedContent}
</body>
</html>`;
}

/**
 * Exports document as a self-contained HTML file. Math and code styles,
 * including KaTeX fonts, are inlined as data so the file works offline
 * and without any external requests.
 */
export async function exportAsHtml(
  filename: string,
  markdownContent: string,
) {
  const finalName = filename.replace(/\.md$/, "") + ".html";
  const { exportStyles } = await import("./exportAssets");
  const htmlDocument = buildHtmlDocument(filename, markdownContent, exportStyles);

  const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, finalName);
}

/**
 * Triggers browser print dialog for printing or saving to PDF
 */
export function exportAsPdf() {
  window.print();
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return m;
    }
  });
}
