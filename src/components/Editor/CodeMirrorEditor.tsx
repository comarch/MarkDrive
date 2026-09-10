import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { EditorState, Extension } from "@codemirror/state";
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
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  bracketMatching,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { SelectionInfo } from "../../types/editor";

export interface CodeMirrorEditorHandle {
  insertText: (before: string, after?: string, defaultText?: string) => void;
  insertBlock: (text: string) => void;
  getScrollPercentage: () => number;
  scrollToPercentage: (percentage: number) => void;
  focus: () => void;
  scrollToLine: (lineNumber: number) => void;
  openSearch: () => void;
}

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  isDark: boolean;
  fontSize: number;
  onScroll?: (percentage: number) => void;
  onSelectionChange?: (selection: SelectionInfo | null) => void;
  commentedLines?: number[];
}

export const CodeMirrorEditor = forwardRef<
  CodeMirrorEditorHandle,
  CodeMirrorEditorProps
>(({ value, onChange, isDark, fontSize, onScroll, onSelectionChange }, ref) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const valueRef = useRef(value);
  const callbacksRef = useRef({ onChange, onScroll, onSelectionChange });

  valueRef.current = value;
  callbacksRef.current = { onChange, onScroll, onSelectionChange };

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
      EditorView.lineWrapping,
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
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
              return;
            }
          }
          callbacksRef.current.onSelectionChange?.(null);
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

  // Update document if value changed externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorContainerRef}
      className="w-full h-full overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
    />
  );
});

CodeMirrorEditor.displayName = "CodeMirrorEditor";
