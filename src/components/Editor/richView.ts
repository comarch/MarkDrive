import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Extension, Range } from "@codemirror/state";

/**
 * WYSIWYG overlay for the source editor.
 *
 * Inline replace decorations hide raw Markdown marks and mark decorations
 * style the text they wrap, so authors see formatted prose while the
 * document keeps its exact Markdown bytes. Nothing here mutates the
 * document; every decoration is derived from the Lezer markdown tree.
 */

const boldMark = Decoration.mark({ class: "cm-rich-bold" });
const italicMark = Decoration.mark({ class: "cm-rich-italic" });
const strikeMark = Decoration.mark({ class: "cm-rich-strike" });
const codeMark = Decoration.mark({ class: "cm-rich-code" });
const linkTextMark = Decoration.mark({ class: "cm-rich-link-text" });

const hide = (from: number, to: number): Range<Decoration> =>
  Decoration.replace({}).range(from, to);

const headingLines: Record<string, string> = {
  ATXHeading1: "cm-rich-h1",
  ATXHeading2: "cm-rich-h2",
  ATXHeading3: "cm-rich-h3",
  ATXHeading4: "cm-rich-h4",
  ATXHeading5: "cm-rich-h5",
  ATXHeading6: "cm-rich-h6",
};

interface NodeLike {
  name: string;
  from: number;
  to: number;
  firstChild: NodeLike | null;
  lastChild: NodeLike | null;
  nextSibling: NodeLike | null;
}

// Hides the leading '#' marks of an ATX heading and tags the line with a
// heading class. Setext underlines stay visible to keep the source honest.
const decorateHeading = (
  node: NodeLike,
  lineFrom: number,
  add: Range<Decoration>[],
) => {
  const mark = node.firstChild;
  if (mark?.name === "HeaderMark") {
    add.push(hide(mark.from, mark.to));
  }
  const lineClass = headingLines[node.name];
  if (lineClass) {
    add.push(Decoration.line({ class: lineClass }).range(lineFrom));
  }
};

// Emphasis-like nodes put their delimiters in the first and last children.
// Both delimiters collapse; the content between gets styled.
const decorateEmphasis = (
  node: NodeLike,
  style: Decoration,
  add: Range<Decoration>[],
) => {
  const first = node.firstChild;
  const last = node.lastChild;
  if (!first || !last) return;
  add.push(hide(first.from, first.to));
  if (last !== first) {
    add.push(hide(last.from, last.to));
    if (first.to < last.from) {
      add.push(style.range(first.to, last.from));
    }
  }
};

// Inline code hides its backticks and shows monospace text on a chip.
const decorateInlineCode = (node: NodeLike, add: Range<Decoration>[]) => {
  const first = node.firstChild;
  const last = node.lastChild;
  if (!first || !last) return;
  const pieces: Range<Decoration>[] = [hide(first.from, first.to)];
  if (last !== first) {
    pieces.push(hide(last.from, last.to), codeMark.range(first.to, last.from));
  }
  add.push(...pieces);
};

// Links show only the label, styled like a preview link. Inline links
// parse as Link { LinkMark "[", text, LinkMark "]", LinkMark "(", URL,
// LinkMark ")" }, so everything from the closing bracket on collapses.
// Autolinks (<...>) and images keep their source.
const decorateLink = (node: NodeLike, add: Range<Decoration>[]) => {
  const marks: NodeLike[] = [];
  let child = node.firstChild;
  while (child) {
    if (child.name === "LinkMark") marks.push(child);
    child = child.nextSibling;
  }
  if (marks.length < 2 || !marks[0] || !marks[1]) return;
  const open = marks[0];
  const close = marks[1];
  const pieces: Range<Decoration>[] = [
    hide(open.from, open.to),
    hide(close.from, node.to),
  ];
  if (open.to < close.from) {
    pieces.push(linkTextMark.range(open.to, close.from));
  }
  add.push(...pieces);
};

const buildDecorations = (view: EditorView): DecorationSet => {
  const add: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (ref) => {
        const node = ref.node as unknown as NodeLike;
        switch (ref.name) {
          case "ATXHeading1":
          case "ATXHeading2":
          case "ATXHeading3":
          case "ATXHeading4":
          case "ATXHeading5":
          case "ATXHeading6":
            decorateHeading(node, view.state.doc.lineAt(ref.from).from, add);
            break;
          case "StrongEmphasis":
            decorateEmphasis(node, boldMark, add);
            break;
          case "Emphasis":
            decorateEmphasis(node, italicMark, add);
            break;
          case "StrikeThrough":
            decorateEmphasis(node, strikeMark, add);
            break;
          case "InlineCode":
            decorateInlineCode(node, add);
            break;
          case "Link":
            decorateLink(node, add);
            break;
          default:
            break;
        }
      },
    });
  }
  return Decoration.set(add, true);
};

const richViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

// Heading sizes are relative to the editor's configured font size, so the
// A-/A+ zoom keeps working in rich view.
const richViewTheme = EditorView.theme({
  ".cm-rich-bold": {
    fontWeight: "700",
  },
  ".cm-rich-italic": {
    fontStyle: "italic",
  },
  ".cm-rich-strike": {
    textDecoration: "line-through",
  },
  ".cm-rich-code": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    backgroundColor: "rgba(127, 127, 127, 0.15)",
    borderRadius: "3px",
    padding: "0.1em 0.25em",
    fontSize: "0.9em",
  },
  ".cm-rich-link-text": {
    color: "#0018CE",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  ".cm-rich-h1": {
    fontSize: "1.7em",
    fontWeight: "700",
    lineHeight: "1.3",
  },
  ".cm-rich-h2": {
    fontSize: "1.45em",
    fontWeight: "700",
    lineHeight: "1.3",
  },
  ".cm-rich-h3": {
    fontSize: "1.25em",
    fontWeight: "600",
    lineHeight: "1.35",
  },
  ".cm-rich-h4": {
    fontSize: "1.1em",
    fontWeight: "600",
  },
  ".cm-rich-h5": {
    fontWeight: "600",
  },
  ".cm-rich-h6": {
    fontWeight: "600",
    opacity: "0.9",
  },
});

/**
 * Full WYSIWYG overlay: hidden marks, styled emphasis, links, inline code,
 * and heading line classes. Mount only while the mode is on.
 */
export const richViewExtension: Extension = [richViewPlugin, richViewTheme];
