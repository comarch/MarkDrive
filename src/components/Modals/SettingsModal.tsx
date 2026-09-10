import React, { useState } from "react";
import { X, Settings, Key, Save, HelpCircle } from "lucide-react";
import { AppSettings } from "../../types/editor";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [clientId, setClientId] = useState(settings.googleClientId);
  const [autoSaveInterval, setAutoSaveInterval] = useState(
    settings.autoSaveIntervalMs,
  );
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [syncScroll, setSyncScroll] = useState(settings.syncScroll);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      googleClientId: clientId.trim(),
      autoSaveIntervalMs: autoSaveInterval,
      fontSize,
      syncScroll,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Application Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 flex flex-col gap-5">
          {/* Google OAuth Client ID */}
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1.5">
              <Key className="w-3.5 h-3.5 text-brand-600" />
              <span>Google Cloud OAuth 2.0 Client ID</span>
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
              <span>
                Required for connecting to Google Drive & Google Comments API.
                If empty, editor operates in demo/local simulation mode.
              </span>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          {/* Auto-save interval */}
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1.5">
              Auto-save Interval to Google Drive
            </label>
            <select
              value={autoSaveInterval}
              onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value={1000}>Every 1 second</option>
              <option value={2000}>Every 2 seconds (Recommended)</option>
              <option value={5000}>Every 5 seconds</option>
              <option value={10000}>Every 10 seconds</option>
              <option value={0}>Manual save only (Ctrl + S)</option>
            </select>
          </div>

          {/* Editor Font Size */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Editor Font Size
              </label>
              <span className="text-xs font-mono text-slate-500">
                {fontSize}px
              </span>
            </div>
            <input
              type="range"
              min="12"
              max="22"
              step="1"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
          </div>

          {/* Sync Scrolling */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Synchronized Scrolling
              </div>
              <div className="text-[11px] text-slate-500">
                Keep editor and preview panes scrolled in parallel
              </div>
            </div>
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
