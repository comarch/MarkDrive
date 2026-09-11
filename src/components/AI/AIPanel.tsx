import React, { useMemo, useState } from "react";
import { X, Sparkles, Loader2, Info } from "lucide-react";
import {
  AI_BUILD_ENABLED,
  AICommandId,
  AISettings,
  AIActionContext,
  availableCommands,
  runAICommand,
} from "../../services/ai";
import { t, type StringKey } from "../../i18n";

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  context: AIActionContext;
  onInsertAtCursor: (text: string) => void;
  onReplaceDocument: (text: string) => void;
  /** Applies the result as a suggestion patch (commentToPatch). */
  onApplySuggestion: (text: string) => void;
}

const INPUT_COMMANDS = new Set<AICommandId>([
  "draft",
  "askDoc",
  "tableFromProse",
  "mermaidFromDescription",
]);

const THREAD_COMMANDS = new Set<AICommandId>([
  "summarizeThread",
  "commentToPatch",
]);

export const AIPanel: React.FC<AIPanelProps> = ({
  isOpen,
  onClose,
  settings,
  context,
  onInsertAtCursor,
  onReplaceDocument,
  onApplySuggestion,
}) => {
  const [command, setCommand] = useState<AICommandId>("summarizeDoc");
  const [input, setInput] = useState("");
  const [threadIndex, setThreadIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commands = useMemo(() => availableCommands(context), [context]);

  if (!isOpen || !AI_BUILD_ENABLED) return null;

  const needsInput = INPUT_COMMANDS.has(command);
  const needsThread = THREAD_COMMANDS.has(command);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    // Thread commands work on the thread the user picked.
    const narrowed: AIActionContext = needsThread
      ? {
          ...context,
          commentThreads: [context.commentThreads[threadIndex] ?? ""],
        }
      : context;
    const response = await runAICommand(settings, { command, input }, narrowed);
    setRunning(false);
    if (response.ok) {
      setResult(response.text);
    } else {
      setError(response.error ?? t("ai.error"));
    }
  };

  return (
    <aside
      data-testid="ai-panel"
      className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full no-print"
    >
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t("ai.title")}
          </h3>
        </div>
        <button
          onClick={onClose}
          title={t("ai.close")}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Privacy notice: this feature is a new network path. */}
      <div className="mx-3 mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex gap-2 items-start">
        <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-300">
          {t("ai.banner")}
        </p>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        <div>
          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
            {t("ai.command")}
          </label>
          <select
            value={command}
            onChange={(e) => {
              setCommand(e.target.value as AICommandId);
              setResult(null);
              setError(null);
            }}
            aria-label={t("ai.command")}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            {commands.map((id) => (
              <option key={id} value={id}>
                {t(`ai.cmd.${id}` as StringKey)}
              </option>
            ))}
          </select>
        </div>

        {needsThread && context.commentThreads.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
              {t("ai.thread")}
            </label>
            <select
              value={threadIndex}
              onChange={(e) => setThreadIndex(Number(e.target.value))}
              aria-label={t("ai.thread")}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              {(() => {
                const seen = new Map<string, number>();
                return context.commentThreads.map((thread, index) => {
                  const label = thread.slice(0, 60) || "(empty)";
                  const seenCount = (seen.get(label) ?? 0) + 1;
                  seen.set(label, seenCount);
                  return (
                    <option
                      key={seenCount > 1 ? `${label}-${seenCount}` : label}
                      value={index}
                    >
                      {label}
                    </option>
                  );
                });
              })()}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
            {needsInput ? t("ai.inputRequired") : t("ai.inputOptional")}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder={t("ai.inputPlaceholder")}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-y"
          />
        </div>

        <button
          onClick={run}
          disabled={running}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold transition"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {t("ai.run")}
        </button>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {result !== null && (
          <div className="space-y-2">
            <pre className="text-xs whitespace-pre-wrap p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
              {result}
            </pre>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onInsertAtCursor(result)}
                className="px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium"
              >
                {t("ai.insert")}
              </button>
              <button
                onClick={() => onReplaceDocument(result)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t("ai.replaceDoc")}
              </button>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(result);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t("ai.copy")}
              </button>
              {command === "commentToPatch" && (
                <button
                  onClick={() => onApplySuggestion(result)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                >
                  {t("ai.applySuggestion")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
