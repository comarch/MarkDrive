import React, { useCallback, useEffect, useState } from "react";
import { X, Network, RefreshCw, CornerUpLeft } from "lucide-react";
import { buildFolderGraph, type FolderGraph } from "../../services/linkIndex";

interface GraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string | null;
  currentFileId: string | null;
  currentFileName: string | null;
  onOpenFile: (fileId: string) => void;
}

const SIZE = 420;
const RADIUS = 160;

/**
 * Folder-level link graph with a backlink list for the open document.
 */
export const GraphModal: React.FC<GraphModalProps> = ({
  isOpen,
  onClose,
  folderId,
  currentFileId,
  currentFileName,
  onOpenFile,
}) => {
  const [graph, setGraph] = useState<FolderGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await buildFolderGraph(folderId, currentFileId);
      setGraph(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }, [folderId, currentFileId]);

  useEffect(() => {
    if (isOpen) {
      void loadGraph();
    }
  }, [isOpen, loadGraph]);

  if (!isOpen) return null;

  // Circle layout: deterministic, no physics dependency.
  const nodes = graph?.nodes ?? [];
  const positions = new Map(
    nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(1, nodes.length);
      return [
        node.id,
        {
          x: SIZE / 2 + RADIUS * Math.cos(angle),
          y: SIZE / 2 + RADIUS * Math.sin(angle),
        },
      ];
    }),
  );

  const backlinks =
    graph && currentFileId
      ? graph.edges
          .filter((edge) => edge.toId === currentFileId)
          .map((edge) => {
            const node = nodes.find((n) => n.id === edge.fromId);
            return { id: edge.fromId, name: node?.name ?? edge.fromId };
          })
      : [];

  const nodeLabel = (name: string): string => {
    const stripped = name.replace(/\.(md|markdown)$/i, "");
    return stripped.length > 18 ? `${stripped.slice(0, 16)}...` : stripped;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Folder link graph
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {folderId && (
              <button
                onClick={() => void loadGraph()}
                title="Refresh graph"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            )}
            <button
              onClick={onClose}
              title="Close graph"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {!folderId && (
            <div className="text-center py-8 px-4 text-slate-400 text-xs">
              <Network className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">
                The link graph needs a Drive folder.
              </p>
              <p className="text-[11px] mt-1">
                Open a file from a Google Drive folder to see how documents link
                together.
              </p>
            </div>
          )}

          {folderId && error && (
            <div className="text-xs text-rose-600 dark:text-rose-400 px-1 py-2">
              Could not build the graph: {error}
            </div>
          )}

          {folderId && !error && loading && !graph && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Building folder graph...
            </div>
          )}

          {folderId && !error && graph && nodes.length === 0 && (
            <div className="text-center py-8 px-4 text-slate-400 text-xs">
              No Markdown files in this folder yet.
            </div>
          )}

          {folderId && !error && graph && nodes.length > 0 && (
            <>
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="w-full h-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40"
                role="img"
                aria-label="Link graph of the folder"
              >
                {graph.edges.map((edge) => {
                  const from = positions.get(edge.fromId);
                  const to = positions.get(edge.toId);
                  if (!from || !to) return null;
                  return (
                    <line
                      key={`${edge.fromId}-${edge.toId}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      className="stroke-slate-300 dark:stroke-slate-700"
                      strokeWidth={1}
                    />
                  );
                })}
                {nodes.map((node) => {
                  const pos = positions.get(node.id);
                  if (!pos) return null;
                  return (
                    <g key={node.id}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={node.isCurrent ? 10 : 7}
                        className={
                          node.isCurrent
                            ? "fill-brand-600 stroke-brand-800"
                            : "fill-slate-400 dark:fill-slate-500 stroke-slate-500 dark:stroke-slate-400"
                        }
                        strokeWidth={2}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 20}
                        textAnchor="middle"
                        className="fill-slate-600 dark:fill-slate-300"
                        style={{ fontSize: 10 }}
                      >
                        {nodeLabel(node.name)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  <span>Backlinks to {nodeLabel(currentFileName ?? "")}</span>
                </div>
                {backlinks.length === 0 ? (
                  <div className="text-[11px] text-slate-400 px-1">
                    No documents in this folder link here yet.
                  </div>
                ) : (
                  backlinks.map((backlink) => (
                    <button
                      key={backlink.id}
                      onClick={() => {
                        onOpenFile(backlink.id);
                        onClose();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 transition"
                    >
                      {backlink.name}
                    </button>
                  ))
                )}
                {graph.unresolved.length > 0 && (
                  <div className="text-[10px] text-slate-400 mt-2 px-1">
                    {graph.unresolved.length} link target
                    {graph.unresolved.length === 1 ? "" : "s"} without a
                    matching file.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
