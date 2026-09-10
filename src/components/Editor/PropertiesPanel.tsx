import React, { useState } from "react";
import { X, FileCog } from "lucide-react";
import {
  REVIEW_STATUS_FIELD,
  REVIEW_STATUSES,
  reviewStatusLabel,
} from "../../utils/reviewStatus";

interface PropertiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fields: Record<string, unknown>;
  onUpdateField: (key: string, value: string) => void;
}

/**
 * YAML frontmatter properties. String fields are editable; anything richer
 * stays read-only so the raw block is never reformatted by accident.
 */
export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  isOpen,
  onClose,
  fields,
  onUpdateField,
}) => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  if (!isOpen) return null;

  const entries = Object.entries(fields);
  const hasNewKey = newKey.trim().length > 0 && !(newKey.trim() in fields);

  // Review status gets a select; other strings stay plain inputs; anything
  // richer stays read-only so the raw block is never reformatted by accident.
  const renderValue = (key: string, value: unknown) => {
    if (key === REVIEW_STATUS_FIELD && typeof value === "string") {
      return (
        <select
          value={value}
          onChange={(e) => onUpdateField(key, e.target.value)}
          aria-label="Review status"
          className="flex-1 min-w-0 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {REVIEW_STATUSES.map((status) => (
            <option key={status} value={status}>
              {reviewStatusLabel(status)}
            </option>
          ))}
          {/* Preserve unknown custom values instead of dropping them. */}
          {!REVIEW_STATUSES.includes(value as never) && (
            <option value={value}>{value}</option>
          )}
        </select>
      );
    }
    if (typeof value === "string") {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onUpdateField(key, e.target.value)}
          aria-label={`Value for ${key}`}
          className="flex-1 min-w-0 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      );
    }
    return (
      <code className="flex-1 min-w-0 text-[11px] text-slate-500 dark:text-slate-400 truncate">
        {JSON.stringify(value)}
      </code>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <FileCog className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Document properties
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {entries.length === 0 && (
            <div className="text-center py-6 px-3 text-slate-400 text-xs">
              No frontmatter yet. Add a field to create the block.
            </div>
          )}

          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-28 shrink-0 truncate">
                {key}
              </span>
              {renderValue(key, value)}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              placeholder="New field"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              aria-label="New field name"
              className="w-28 shrink-0 text-xs px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="text"
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              aria-label="New field value"
              className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              disabled={!hasNewKey}
              onClick={() => {
                onUpdateField(newKey.trim(), newValue);
                setNewKey("");
                setNewValue("");
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
