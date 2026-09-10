import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import footnotePlugin from "markdown-it-footnote";
import deflistPlugin from "markdown-it-deflist";
import { full as emojiPlugin } from "markdown-it-emoji";
import anchorPlugin from "markdown-it-anchor";
import hljs from "highlight.js";
import katex from "katex";
import DOMPurify from "dompurify";
import { DriveComment } from "../../types/drive";
import { findTaskListLines } from "../../utils/tasks";
import {
  frontmatterLineOffset,
  parseFrontmatter,
} from "../../utils/frontmatter";

// Long quoted text makes the lazy-quantifier highlight regex backtrack
// quadratically on large documents; skip highlighting above this cap.
const MAX_HIGHLIGHT_QUOTE_LENGTH = 200;

const ALLOWED_TAGS = [
  "a",
  "annotation",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "input",
  "li",
  "label",
  "mark",
  "math",
  "menclose",
  "mfrac",
  "mi",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mprescripts",
  "mroot",
  "mrow",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "none",
  "ol",
  "p",
  "pre",
  "semantics",
  "section",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];
const ALLOWED_ATTRIBUTES = [
  "accent",
  "alt",
  "aria-hidden",
  "checked",
  "class",
  "colspan",
  "columnalign",
  "columnspacing",
  "data-comment-id",
  "data-task-line",
  "data-doc-link",
  "data-wikilink",
  "depth",
  "disabled",
  "display",
  "displaystyle",
  "encoding",
  "fence",
  "for",
  "form",
  "height",
  "href",
  "id",
  "largeop",
  "linebreak",
  "lspace",
  "maxsize",
  "minsize",
  "movablelimits",
  "name",
  "rowlines",
  "rowspan",
  "rowspacing",
  "rspace",
  "scriptlevel",
  "role",
  "separator",
  "src",
  "start",
  "stretchy",
  "style",
  "symmetric",
  "title",
  "type",
  "width",
  "xmlns",
];
const SAFE_STYLE =
  /^(?:(?:(?:border-bottom-width|height|margin-left|margin-right|min-width|padding-left|top|vertical-align|width):\s*-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|%))|(?:position:\s*relative)|(?:text-align:\s*(?:center|left|right)));?(?:\s*(?:(?:border-bottom-width|height|margin-left|margin-right|min-width|padding-left|top|vertical-align|width):\s*-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|%)|position:\s*relative|text-align:\s*(?:center|left|right));?)*$/;

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "style" && !SAFE_STYLE.test(data.attrValue)) {
    data.keepAttr = false;
  }
  if (
    (data.attrName === "href" || data.attrName === "src") &&
    (/^\/\//.test(data.attrValue) || /^data:/i.test(data.attrValue))
  ) {
    data.keepAttr = false;
  }
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName === "INPUT") {
    const isTaskCheckbox = node.classList.contains("task-list-item-checkbox");
    // Preview click handling needs the click event, and browsers suppress events on disabled inputs.
    if (isTaskCheckbox) {
      node.removeAttribute("disabled");
    } else {
      node.setAttribute("disabled", "");
    }
    node.setAttribute("type", "checkbox");
  }
  if (node.nodeName === "A") {
    node.setAttribute("rel", "noopener noreferrer");
  }
});

// Setup markdown-it instance with syntax highlighting
export const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string) {
    const normalized = lang.toLowerCase();

    if (normalized === "mermaid") {
      return `<div class="mermaid">${md.utils.escapeHtml(str)}</div>`;
    }

    // Graphviz sources render to SVG in the preview after parsing.
    if (normalized === "dot" || normalized === "graphviz") {
      return `<div class="graphviz-src">${md.utils.escapeHtml(str)}</div>`;
    }

    // Excalidraw scenes embed as view-only islands in the preview.
    if (normalized === "excalidraw") {
      return `<div class="excalidraw-embed">${md.utils.escapeHtml(str)}</div>`;
    }

    if (normalized && ["math", "latex", "katex"].includes(normalized)) {
      try {
        return `<div class="katex-display">${katex.renderToString(str, {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch {
        return `<pre><code>${md.utils.escapeHtml(str)}</code></pre>`;
      }
    }

    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code class="language-${lang}">${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch {
        // fallback
      }
    }

    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

// Add plugins
md.use(taskLists, { enabled: true, label: true });
md.use(footnotePlugin);
md.use(deflistPlugin);
md.use(emojiPlugin);
md.use(anchorPlugin, {
  slugify: (s: string) =>
    encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-")),
  permalink: false,
});

/**
 * Pre-processes text for LaTeX equations before markdown parsing.
 * Supports $$display$$ and $inline$. Display equations get a running
 * number; frontmatter math-macros expand custom commands.
 */
function renderMathFormulas(
  text: string,
  macros: Record<string, string>,
): string {
  let equationNumber = 0;

  // Replace display math $$...$$
  let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
        macros,
      });
      equationNumber += 1;
      return `<div class="katex-display"><span class="equation-number">(${equationNumber})</span>${rendered}</div>`;
    } catch {
      return `$$${math}$$`;
    }
  });

  // Replace inline math $...$ (avoiding currency $10)
  processed = processed.replace(
    /(^|[^\\])\$([^$\n]+?)\$/g,
    (_match, prefix, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
          macros,
        });
        return `${prefix}${rendered}`;
      } catch {
        return `${prefix}$${math}$`;
      }
    },
  );

  return processed;
}

/**
 * Inserts comment highlight tags into the generated HTML based on active Drive comments
 */
export function injectCommentHighlights(
  html: string,
  comments: DriveComment[],
): string {
  if (!comments || comments.length === 0) return html;

  let enrichedHtml = html;

  comments.forEach((comment) => {
    const quoted = comment.quotedFileContent?.value?.trim();
    if (!quoted || quoted.length < 2) return;
    if (quoted.length > MAX_HIGHLIGHT_QUOTE_LENGTH) return;

    // Avoid injecting into tag attributes or pre/code tags
    const escapedQuoted = quoted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `(?<=>)([^<]*?)(${escapedQuoted})([^<]*?)(?=<)`,
      "g",
    );

    enrichedHtml = enrichedHtml.replace(regex, (_m, before, target, after) => {
      const id = md.utils.escapeHtml(comment.id);
      const title = md.utils.escapeHtml(
        `Comment by ${comment.author?.displayName || "User"}: ${comment.content}`,
      );
      const mark = `<mark class="comment-highlight ${
        comment.resolved ? "resolved opacity-50" : "active"
      }" data-comment-id="${id}" title="${title}">${target}</mark>`;
      return `${before}${mark}${after}`;
    });
  });

  return enrichedHtml;
}

/**
 * Turns [[wikilinks]] into placeholder links outside code fences, so the
 * preview can resolve them against the current Drive folder like relative
 * document links. [[Name|Label]] renders Label pointing at Name.
 */
function renderWikiLinks(text: string): string {
  const lines = text.split("\n");
  let fence: string | null = null;

  return lines
    .map((line) => {
      const trimmed = line.trimStart();
      if (fence === null) {
        if (/^(```|~~~)/.test(trimmed)) {
          fence = trimmed.slice(0, 3);
          return line;
        }
      } else {
        if (trimmed.startsWith(fence)) fence = null;
        return line;
      }

      return line.replace(
        /\[\[([^\]|]{1,400})(?:\|([^\]]{0,400}))?\]\]/g,
        (_match, name: string, label?: string) => {
          const target = name.trim();
          if (!target) return _match;
          const text2 = (label ?? target).trim();
          // The URI must carry no raw spaces, or the link syntax breaks.
          return `[${text2}](wiki:${encodeURIComponent(target)})`;
        },
      );
    })
    .join("\n");
}

/**
 * Parses markdown source into rich HTML with math, diagrams, and comments
 */
export function parseMarkdown(
  markdownText: string,
  comments: DriveComment[] = [],
): string {
  // Frontmatter is metadata: hidden from the preview, kept in the source.
  const { body, fields } = parseFrontmatter(markdownText);
  // KaTeX macros from frontmatter, keyed with or without the backslash.
  const rawMacros = fields["math-macros"];
  const macros: Record<string, string> = {};
  if (rawMacros && typeof rawMacros === "object" && !Array.isArray(rawMacros)) {
    for (const [key, value] of Object.entries(
      rawMacros as Record<string, unknown>,
    )) {
      if (typeof value !== "string") continue;
      const name = key.startsWith("\\") ? key : `\\${key}`;
      macros[name] = value;
    }
  }
  const withWikilinks = renderWikiLinks(body);
  const withMath = renderMathFormulas(withWikilinks, macros);
  const rawHtml = md.render(withMath);
  // Task checkboxes map back to source lines, so add the hidden block height.
  const taskLineOffset = frontmatterLineOffset(markdownText);
  const taskLines = findTaskListLines(body).map(
    (line) => line + taskLineOffset,
  );
  const taskCheckboxPattern =
    /<input\b[^>]*class="[^"]*\btask-list-item-checkbox\b[^"]*"[^>]*>/g;
  // Pair rendered checkboxes with source lines by index. When the two counts
  // disagree (edge syntax the regex and the renderer treat differently), skip
  // the annotation entirely so a click can never toggle the wrong line.
  const linesMatchRendered =
    (rawHtml.match(taskCheckboxPattern)?.length ?? 0) === taskLines.length;
  let taskCheckboxIndex = 0;
  const annotatedHtml = rawHtml.replace(taskCheckboxPattern, (tag) => {
    if (!linesMatchRendered) return tag;
    const lineNumber = taskLines[taskCheckboxIndex];
    taskCheckboxIndex += 1;
    if (lineNumber === undefined) return tag;

    return tag.replace(
      /\/?>$/,
      (closing) => ` data-task-line="${lineNumber}"${closing}`,
    );
  });
  const highlightedHtml = injectCommentHighlights(annotatedHtml, comments);

  // Relative links point at Markdown files in the same Drive folder; the
  // preview resolves them on click instead of navigating the browser.
  const docLinkPattern = /<a href="([^"]+)"/g;
  const withDocLinks = highlightedHtml.replace(
    docLinkPattern,
    (match, href: string) => {
      // Wikilink placeholders become folder-resolvable links.
      const wikilink = /^wiki:(.+)$/.exec(href);
      if (wikilink?.[1] !== undefined) {
        let name: string;
        try {
          name = decodeURIComponent(wikilink[1]);
        } catch {
          name = wikilink[1];
        }
        const escaped = md.utils.escapeHtml(name);
        return `<a href="#wikilink" class="wikilink" data-wikilink="${escaped}"`;
      }
      const isExternal =
        /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) ||
        href.startsWith("#") ||
        /^data:/i.test(href);
      if (isExternal) return match;
      return `<a href="${href}" class="doc-link" data-doc-link="${href}"`;
    },
  );

  // GitHub-style callouts: a blockquote that opens with [!TYPE] becomes a
  // titled callout. Only known types transform, so nothing free-form enters.
  const CALLOUT_PATTERN =
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/gi;
  const withCallouts = withDocLinks.replace(
    CALLOUT_PATTERN,
    (_match, type: string) => {
      const label = type.charAt(0) + type.slice(1).toLowerCase();
      return `<blockquote class="callout callout-${type.toLowerCase()}"><p class="callout-title">${label}</p><p>`;
    },
  );

  return DOMPurify.sanitize(withCallouts, {
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOWED_TAGS,
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
  });
}
