import React from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  FileCode,
  Table,
  Link,
  Image,
  Sigma,
  GitGraph,
  MessageSquarePlus,
  Columns,
  Eye,
  PenTool,
  Minus,
  Search,
} from "lucide-react";
import { ViewMode } from "../../types/editor";

interface EditorToolbarProps {
  onInsert: (before: string, after?: string, defaultText?: string) => void;
  onInsertBlock: (text: string) => void;
  onOpenTableModal: () => void;
  onOpenComment: () => void;
  hasSelection: boolean;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onOpenSearch?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onInsert,
  onInsertBlock,
  onOpenTableModal,
  onOpenComment,
  hasSelection,
  viewMode,
  onChangeViewMode,
  onOpenSearch,
}) => {
  return (
    <div className="h-10 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-3 flex items-center justify-between gap-1 overflow-x-auto text-slate-700 dark:text-slate-300 no-print select-none">
      {/* Left Formatting Tools */}
      <div className="flex items-center space-x-1 shrink-0">
        {/* Headings */}
        <button
          onClick={() => onInsert("# ", "", "Heading 1")}
          title="Heading 1 (H1)"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsert("## ", "", "Heading 2")}
          title="Heading 2 (H2)"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsert("### ", "", "Heading 3")}
          title="Heading 3 (H3)"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Text Styles */}
        <button
          onClick={() => onInsert("**", "**", "bold text")}
          title="Bold (Ctrl+B)"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsert("*", "*", "italic text")}
          title="Italic (Ctrl+I)"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsert("~~", "~~", "strikethrough text")}
          title="Strikethrough"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition line-through"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Lists & Tasks */}
        <button
          onClick={() => onInsert("- ", "", "List item")}
          title="Bullet List"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsert("1. ", "", "Ordered item")}
          title="Numbered List"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsert("- [ ] ", "", "Task item")}
          title="Task List"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <CheckSquare className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Blockquote, Code, HR */}
        <button
          onClick={() => onInsert("> ", "", "Quote text")}
          title="Blockquote"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsert("`", "`", "code")}
          title="Inline Code"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsertBlock("```javascript\n// code here\n```")}
          title="Code Block"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <FileCode className="w-4 h-4" />
        </button>
        <button
          onClick={() => onInsertBlock("---\n")}
          title="Horizontal Rule"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        <button
          onClick={() => onOpenSearch?.()}
          title="Search and replace (Ctrl+F)"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Link, Image, Table */}
        <button
          onClick={() =>
            onInsert("[", "](https://example.invalid)", "Link title")
          }
          title="Insert Link"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Link className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            onInsert(
              "![",
              "](https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400)",
              "Alt text",
            )
          }
          title="Insert Image"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Image className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenTableModal}
          title="Insert Table"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Table className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Math KaTeX & Mermaid */}
        <button
          onClick={() => onInsert("$$", "$$", "E = mc^2")}
          title="KaTeX Math Formula"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Sigma className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            onInsertBlock(
              "```mermaid\ngraph TD;\n    A-->B;\n    A-->C;\n    B-->D;\n    C-->D;\n```",
            )
          }
          title="Insert Mermaid Diagram"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <GitGraph className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Google Drive Comment Button */}
        <button
          onClick={onOpenComment}
          title={
            hasSelection
              ? "Add comment to selection (Ctrl+Alt+M)"
              : "Select text in document to comment"
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
            hasSelection
              ? "bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 hover:bg-amber-200"
              : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          }`}
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Comment</span>
        </button>
      </div>

      {/* Right View Mode Switcher */}
      <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-md shrink-0">
        <button
          onClick={() => onChangeViewMode("editor")}
          title="Editor only"
          className={`p-1 rounded text-xs transition ${
            viewMode === "editor"
              ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onChangeViewMode("split")}
          title="Split View"
          className={`p-1 rounded text-xs transition ${
            viewMode === "split"
              ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Columns className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onChangeViewMode("preview")}
          title="Preview only"
          className={`p-1 rounded text-xs transition ${
            viewMode === "preview"
              ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
