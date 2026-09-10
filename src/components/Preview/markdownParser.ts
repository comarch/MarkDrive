import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { full as emojiPlugin } from "markdown-it-emoji";
import anchorPlugin from "markdown-it-anchor";
import hljs from "highlight.js";
import katex from "katex";
import DOMPurify from "dompurify";
import { DriveComment } from "../../types/drive";

const ALLOWED_TAGS = [
  "a",
  "annotation",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
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
    node.setAttribute("disabled", "");
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
    if (lang && lang.toLowerCase() === "mermaid") {
      return `<div class="mermaid">${md.utils.escapeHtml(str)}</div>`;
    }

    if (lang && ["math", "latex", "katex"].includes(lang.toLowerCase())) {
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
md.use(emojiPlugin);
md.use(anchorPlugin, {
  slugify: (s: string) =>
    encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-")),
  permalink: false,
});

/**
 * Pre-processes text for LaTeX equations before markdown parsing.
 * Supports $$display$$ and $inline$.
 */
function renderMathFormulas(text: string): string {
  // Replace display math $$...$$
  let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    try {
      return `<div class="katex-display">${katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      })}</div>`;
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
 * Parses markdown source into rich HTML with math, diagrams, and comments
 */
export function parseMarkdown(
  markdownText: string,
  comments: DriveComment[] = [],
): string {
  const withMath = renderMathFormulas(markdownText);
  const rawHtml = md.render(withMath);
  const highlightedHtml = injectCommentHighlights(rawHtml, comments);

  return DOMPurify.sanitize(highlightedHtml, {
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOWED_TAGS,
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
  });
}
