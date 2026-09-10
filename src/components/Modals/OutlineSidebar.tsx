import React from "react";
import { X, ListTree } from "lucide-react";
import { OutlineItem } from "../../types/editor";

interface OutlineSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  outline: OutlineItem[];
  onSelectHeading: (item: OutlineItem) => void;
}

export const OutlineSidebar: React.FC<OutlineSidebarProps> = ({
  isOpen,
  onClose,
  outline,
  onSelectHeading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="w-72 shrink-0 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-md no-print select-none">
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Document Outline
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {outline.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-xs">
            No headings found. Add `# Heading` to generate outline.
          </div>
        ) : (
          outline.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => onSelectHeading(item)}
              style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
              className="w-full text-left py-1.5 pr-2 rounded text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-brand-600 transition truncate block"
              title={item.text}
            >
              <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                {"#".repeat(item.level)}
              </span>
              <span>{item.text}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
