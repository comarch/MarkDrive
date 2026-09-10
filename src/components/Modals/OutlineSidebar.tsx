import React, { useState } from "react";
import {
  X,
  ListTree,
  ChevronUp,
  ChevronDown,
  Hash,
  Table2,
} from "lucide-react";
import { OutlineItem } from "../../types/editor";

interface OutlineSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  outline: OutlineItem[];
  onSelectHeading: (item: OutlineItem) => void;
  onMoveSection: (headingLine: number, offset: -1 | 1) => void;
  numberingEnabled: boolean;
  onToggleNumbering: () => void;
  onInsertTableOfContents: () => void;
}

export const OutlineSidebar: React.FC<OutlineSidebarProps> = ({
  isOpen,
  onClose,
  outline,
  onSelectHeading,
  onMoveSection,
  numberingEnabled,
  onToggleNumbering,
  onInsertTableOfContents,
}) => {
  const [draggedLine, setDraggedLine] = useState<number | null>(null);
  const [dropTargetLine, setDropTargetLine] = useState<number | null>(null);

  if (!isOpen) return null;

  const dropOn = (targetLine: number) => {
    if (draggedLine === null || draggedLine === targetLine) return;
    // Dropping a heading onto another moves it one step at a time in
    // the direction of the target; repeated drops reach any position.
    onMoveSection(draggedLine, targetLine > draggedLine ? 1 : -1);
    setDraggedLine(null);
    setDropTargetLine(null);
  };

  return (
    <div className="w-72 shrink-0 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-md no-print select-none">
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Document Outline
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleNumbering}
            title={
              numberingEnabled
                ? "Remove heading numbering"
                : "Number level 2+ headings"
            }
            aria-pressed={numberingEnabled}
            className={`p-1 rounded-md transition ${
              numberingEnabled
                ? "bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Hash className="w-4 h-4" />
          </button>
          <button
            onClick={onInsertTableOfContents}
            title="Insert a table of contents"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <Table2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close outline"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {outline.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-xs">
            No headings found. Add `# Heading` to generate outline.
          </div>
        ) : (
          outline.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              draggable
              onDragStart={() => setDraggedLine(item.line)}
              onDragEnd={() => {
                setDraggedLine(null);
                setDropTargetLine(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTargetLine(item.line);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(item.line);
              }}
              className={`group flex items-center rounded transition ${
                dropTargetLine === item.line && draggedLine !== null
                  ? "bg-brand-100 dark:bg-brand-950/40"
                  : "hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
              style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
            >
              <button
                onClick={() => onSelectHeading(item)}
                className="flex-1 min-w-0 text-left py-1.5 pr-1 rounded text-xs text-slate-700 dark:text-slate-300 hover:text-brand-600 transition truncate"
                title={item.text}
              >
                <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                  {"#".repeat(item.level)}
                </span>
                <span>{item.text}</span>
              </button>
              <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition pr-1">
                <button
                  onClick={() => onMoveSection(item.line, -1)}
                  title="Move section up"
                  aria-label={`Move section ${item.text} up`}
                  className="p-0.5 rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onMoveSection(item.line, 1)}
                  title="Move section down"
                  aria-label={`Move section ${item.text} down`}
                  className="p-0.5 rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
