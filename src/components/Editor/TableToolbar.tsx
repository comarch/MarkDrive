import React from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowDownAZ,
  ArrowUpAZ,
} from "lucide-react";
import { TableAction } from "../../utils/tableUtils";

interface TableToolbarProps {
  /** Table column the cursor sits in, 0-based. */
  columnIndex: number;
  onAction: (action: TableAction) => void;
}

/**
 * Context toolbar shown while the cursor is inside a Markdown table.
 * Column actions target the column the cursor sits in.
 */
export const TableToolbar: React.FC<TableToolbarProps> = ({
  columnIndex,
  onAction,
}) => {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md no-print select-none">
      <button
        onClick={() => onAction({ kind: "insert-row" })}
        title="Insert row below"
        className="px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        + Row
      </button>
      <button
        onClick={() => onAction({ kind: "remove-row" })}
        title="Remove last row"
        className="px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        - Row
      </button>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
      <button
        onClick={() => onAction({ kind: "insert-column", columnIndex })}
        title="Insert column before the current one"
        className="px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        + Col
      </button>
      <button
        onClick={() => onAction({ kind: "remove-column", columnIndex })}
        title="Remove the current column"
        className="px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        - Col
      </button>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
      <button
        onClick={() =>
          onAction({ kind: "align-column", columnIndex, align: "left" })
        }
        title="Align the current column left"
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() =>
          onAction({ kind: "align-column", columnIndex, align: "center" })
        }
        title="Align the current column center"
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() =>
          onAction({ kind: "align-column", columnIndex, align: "right" })
        }
        title="Align the current column right"
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
      <button
        onClick={() =>
          onAction({ kind: "sort-column", columnIndex, descending: false })
        }
        title="Sort by the current column, ascending"
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        <ArrowDownAZ className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() =>
          onAction({ kind: "sort-column", columnIndex, descending: true })
        }
        title="Sort by the current column, descending"
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      >
        <ArrowUpAZ className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
