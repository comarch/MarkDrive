import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Compartment, EditorState, Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  highlightActiveLine,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  search,
  searchKeymap,
  highlightSelectionMatches,
  openSearchPanel,
} from "@codemirror/search";
import { linter } from "@codemirror/lint";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  bracketMatching,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { SelectionInfo } from "../../types/editor";
import { extractImageFiles } from "../../utils/clipboardFiles";
import { tsvToMarkdownTable } from "../../utils/tableUtils";
import { lintLinks, lintMarkdown } from "../../services/lint";
import { richViewExtension } from "./richView";

// The WYSIWYG overlay mounts through a compartment, so toggling the
// mode reconfigures the live editor instead of rebuilding it.
const richViewCompartment = new Compartment();

// Quality checks run as native editor diagnostics; the delay keeps
// typing responsive.
const qualityLinter = linter((view) => {
  const text = view.state.doc.toString();
  const diagnostics = [...lintMarkdown(text), ...lintLinks(text)];
  const lineCount = view.state.doc.lines;
  return diagnostics.map((diagnostic) => {
    const lineNumber = Math.min(Math.max(1, diagnostic.line), lineCount);
    const line = view.state.doc.line(lineNumber);
    return {
      from: line.from,
      to: line.to,
      severity: diagnostic.severity,
      message: `${diagnostic.message} (${diagnostic.rule})`,
    };
  });
});

export interface TableCursorContext {
  line: number;
  column: number;
}

export interface CodeMirrorEditorHandle {
  insertText: (before: string, after?: string, defaultText?: string) => void;
  insertBlock: (text: string) => void;
  getScrollPercentage: () => number;
  scrollToPercentage: (percentage: number) => void;
  focus: () => void;
  scrollToLine: (lineNumber: number) => void;
  openSearch: () => void;
  getTableContext: () => TableCursorContext | null;
}

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  isDark: boolean;
  fontSize: number;
  onScroll?: (percentage: number) => void;
  onSelectionChange?: (selection: SelectionInfo | null) => void;
  onImagePaste?: (files: File[]) => void;
  onTableCursorChange?: (context: TableCursorContext | null) => void;
  commentedLines?: number[];
  richView?: boolean;
}

export const CodeMirrorEditor = forwardRef<
  CodeMirrorEditorHandle,
  CodeMirrorEditorProps
>(
  (
    {
      value,
      onChange,
      isDark,
      fontSize,
      onScroll,
      onSelectionChange,
      onImagePaste,
      onTableCursorChange,
      richView = false,
    },
    ref,
  ) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isProgrammaticScrollRef = useRef(false);
    const valueRef = useRef(value);
    const callbacksRef = useRef({
      onChange,
      onScroll,
      onSelectionChange,
      onImagePaste,
      onTableCursorChange,
    });

    valueRef.current = value;
    callbacksRef.current = {
      onChange,
      onScroll,
      onSelectionChange,
      onImagePaste,
      onTableCursorChange,
    };
    // Last reported table context, so cursor moves do not spam callbacks.
    const lastTableContextRef = useRef<TableCursorContext | null>(null);

    // Reports the cursor's table position only when it changes.
    const reportTableContext = (view: EditorView) => {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      if (!line.text.includes("|")) {
        if (lastTableContextRef.current !== null) {
          lastTableContextRef.current = null;
          callbacksRef.current.onTableCursorChange?.(null);
        }
        return;
      }
      let pipesBefore = 0;
      const cursorInLine = from - line.from;
      for (let index = 0; index < cursorInLine; index += 1) {
        if (line.text[index] === "|") pipesBefore += 1;
      }
      const hasLeadingPipe = line.text.trimStart().startsWith("|");
      const context = {
        line: line.number,
        column: Math.max(0, pipesBefore - (hasLeadingPipe ? 1 : 0)),
      };
      const last = lastTableContextRef.current;
      if (last?.line !== context.line || last?.column !== context.column) {
        lastTableContextRef.current = context;
        callbacksRef.current.onTableCursorChange?.(context);
      }
    };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      insertText(before: string, after = "", defaultText = "") {
        const view = viewRef.current;
        if (!view) return;

        const { from, to } = view.state.selection.main;
        const selectedText = view.state.sliceDoc(from, to) || defaultText;
        const replacement = `${before}${selectedText}${after}`;

        view.dispatch({
          changes: { from, to, insert: replacement },
          selection: {
            anchor: from + before.length,
            head: from + before.length + selectedText.length,
          },
        });
        view.focus();
      },

      insertBlock(text: string) {
        const view = viewRef.current;
        if (!view) return;

        const { from } = view.state.selection.main;
        const line = view.state.doc.lineAt(from);
        const insertPos = line.to;
        const insertion = `\n\n${text}\n`;

        view.dispatch({
          changes: { from: insertPos, to: insertPos, insert: insertion },
          selection: { anchor: insertPos + insertion.length },
        });
        view.focus();
      },

      getScrollPercentage() {
        const view = viewRef.current;
        if (!view) return 0;
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        return maxScroll > 0 ? scroller.scrollTop / maxScroll : 0;
      },

      scrollToPercentage(percentage: number) {
        const view = viewRef.current;
        if (!view) return;
        isProgrammaticScrollRef.current = true;
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = maxScroll * Math.min(1, Math.max(0, percentage));
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 50);
      },

      scrollToLine(lineNumber: number) {
        const view = viewRef.current;
        if (!view) return;
        try {
          const doc = view.state.doc;
          const targetLine = Math.min(Math.max(1, lineNumber), doc.lines);
          const linePos = doc.line(targetLine).from;
          view.dispatch({
            selection: { anchor: linePos },
            scrollIntoView: true,
          });
          view.focus();
        } catch {
          // ignore out of bounds
        }
      },

      focus() {
        viewRef.current?.focus();
      },

      openSearch() {
        const view = viewRef.current;
        if (!view) return;
        openSearchPanel(view);
        view.focus();
      },

      getTableContext() {
        const view = viewRef.current;
        if (!view) return null;
        const { from } = view.state.selection.main;
        const line = view.state.doc.lineAt(from);
        if (!line.text.includes("|")) return null;

        // Column index equals the number of pipes before the cursor minus
        // the leading pipe, when the row has one.
        const cursorInLine = from - line.from;
        let pipesBefore = 0;
        for (let index = 0; index < cursorInLine; index += 1) {
          if (line.text[index] === "|") pipesBefore += 1;
        }
        const hasLeadingPipe = line.text.trimStart().startsWith("|");
        const column = Math.max(0, pipesBefore - (hasLeadingPipe ? 1 : 0));
        return { line: line.number, column };
      },
    }));

    // Initialize CodeMirror editor
    useEffect(() => {
      if (!editorContainerRef.current) return;

      const baseTheme = EditorView.theme({
        "&": {
          height: "100%",
          fontSize: `${fontSize}px`,
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
        ".cm-content": {
          padding: "16px 20px",
        },
        ".cm-line": {
          padding: "0 2px",
          lineHeight: "1.6",
        },
      });

      const extensions: Extension[] = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true }),
        qualityLinter,
        // Browser spell checking (including Polish when the browser has
        // the dictionary) applies to the editable text.
        EditorView.contentAttributes.of({ spellcheck: "true" }),
        EditorView.lineWrapping,
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),
        // Mounted empty at first; the richView effect below configures
        // it on mount and on every toggle, so the editor is never
        // rebuilt just to switch modes.
        richViewCompartment.of([]),
        baseTheme,
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            callbacksRef.current.onChange(update.state.doc.toString());
          }

          if (update.selectionSet || update.docChanged) {
            const sel = update.state.selection.main;
            if (!sel.empty) {
              const text = update.state.sliceDoc(sel.from, sel.to).trim();
              if (text.length > 0) {
                const line = update.state.doc.lineAt(sel.from).number;
                const coords = update.view.coordsAtPos(sel.to);
                callbacksRef.current.onSelectionChange?.({
                  from: sel.from,
                  to: sel.to,
                  text,
                  line,
                  coords: coords
                    ? { top: coords.top, left: coords.left }
                    : undefined,
                });
                reportTableContext(update.view);
                return;
              }
            }
            callbacksRef.current.onSelectionChange?.(null);
            reportTableContext(update.view);
          }
        }),
        EditorView.domEventHandlers({
          scroll(_event, view) {
            if (isProgrammaticScrollRef.current) return;
            const scroller = view.scrollDOM;
            const maxScroll = scroller.scrollHeight - scroller.clientHeight;
            if (maxScroll > 0) {
              callbacksRef.current.onScroll?.(scroller.scrollTop / maxScroll);
            }
          },
          paste(event, view) {
            const clipboardEvent = event as ClipboardEvent;
            const data = clipboardEvent.clipboardData;
            const text = data?.getData("text/plain");
            if (text) {
              // Tab-separated content from Sheets or Excel becomes a table.
              const table = tsvToMarkdownTable(text);
              if (table) {
                const { from, to } = view.state.selection.main;
                view.dispatch({
                  changes: { from, to, insert: table },
                  selection: { anchor: from + table.length },
                });
                return true;
              }
              // Other text keeps the native paste.
              return false;
            }
            // Pure image clips are intercepted for upload; mixed text +
            // image clipboards keep their text via the native paste.
            const images = extractImageFiles(Array.from(data?.files ?? []));
            if (images.length > 0 && callbacksRef.current.onImagePaste) {
              callbacksRef.current.onImagePaste(images);
              return true;
            }
            return false;
          },
          drop(event) {
            const dragEvent = event as DragEvent;
            const images = extractImageFiles(
              Array.from(dragEvent.dataTransfer?.files ?? []),
            );
            if (images.length > 0 && callbacksRef.current.onImagePaste) {
              callbacksRef.current.onImagePaste(images);
              return true;
            }
            return false;
          },
        }),
      ];

      if (isDark) {
        extensions.push(oneDark);
      } else {
        extensions.push(
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        );
      }

      const state = EditorState.create({
        doc: valueRef.current,
        extensions,
      });

      const view = new EditorView({
        state,
        parent: editorContainerRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
      };
    }, [isDark, fontSize]); // Re-create if theme or font size changes

    // Toggle the WYSIWYG overlay on the live editor without losing
    // cursor, selection, or undo history.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: richViewCompartment.reconfigure(
          richView ? richViewExtension : [],
        ),
      });
    }, [richView]);

    // Update document if value changed externally. Only the differing middle
    // is replaced, so cursors and undo history outside the change survive.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      if (value === currentDoc) return;

      let start = 0;
      const oldEnd = currentDoc.length;
      const newEnd = value.length;
      while (
        start < oldEnd &&
        start < newEnd &&
        currentDoc[start] === value[start]
      ) {
        start += 1;
      }
      let tailOld = oldEnd;
      let tailNew = newEnd;
      while (
        tailOld > start &&
        tailNew > start &&
        currentDoc[tailOld - 1] === value[tailNew - 1]
      ) {
        tailOld -= 1;
        tailNew -= 1;
      }
      view.dispatch({
        changes: {
          from: start,
          to: tailOld,
          insert: value.slice(start, tailNew),
        },
      });
    }, [value]);

    return (
      <div
        ref={editorContainerRef}
        className="w-full h-full overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
      />
    );
  },
);

CodeMirrorEditor.displayName = "CodeMirrorEditor";
