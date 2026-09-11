import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import mermaid from "mermaid";
import { parseMarkdown } from "./markdownParser";
import { DriveComment } from "../../types/drive";
import { OutlineItem } from "../../types/editor";

export interface MarkdownPreviewHandle {
  getScrollPercentage: () => number;
  scrollToPercentage: (percentage: number) => void;
  scrollToHeading: (id: string) => void;
}

interface MarkdownPreviewProps {
  content: string;
  comments?: DriveComment[];
  isDark: boolean;
  /** Base text size; headings scale relative to it. */
  fontSize?: number;
  onScroll?: (percentage: number) => void;
  onSelectComment?: (commentId: string) => void;
  onToggleTask?: (lineNumber: number, checked: boolean) => void;
  onOpenDocLink?: (target: string) => void;
}

// Task checkbox clicks toggle the matching source line; returns true when
// the click was on a checkbox (handled, with or without a callback).
const handleTaskToggle = (
  target: HTMLElement,
  onToggleTask?: (lineNumber: number, checked: boolean) => void,
): boolean => {
  const checkbox = target.closest("input.task-list-item-checkbox");
  if (!checkbox) return false;
  const lineAttr = checkbox.getAttribute("data-task-line");
  if (!lineAttr || !onToggleTask) return true;
  const lineNumber = Number.parseInt(lineAttr, 10);
  if (!Number.isFinite(lineNumber)) return true;
  onToggleTask(lineNumber, !checkbox.hasAttribute("checked"));
  return true;
};

// Mermaid configuration
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "default",
});

export const MarkdownPreview = forwardRef<
  MarkdownPreviewHandle,
  MarkdownPreviewProps
>(
  (
    {
      content,
      comments = [],
      isDark,
      fontSize = 16,
      onScroll,
      onSelectComment,
      onToggleTask,
      onOpenDocLink,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isProgrammaticScrollRef = useRef(false);

    // Render parsed HTML
    const renderedHtml = useMemo(() => {
      return parseMarkdown(content, comments);
    }, [content, comments]);

    // Expose scroll methods
    useImperativeHandle(ref, () => ({
      getScrollPercentage() {
        const container = containerRef.current;
        if (!container) return 0;
        const maxScroll = container.scrollHeight - container.clientHeight;
        return maxScroll > 0 ? container.scrollTop / maxScroll : 0;
      },

      scrollToPercentage(percentage: number) {
        const container = containerRef.current;
        if (!container) return;
        isProgrammaticScrollRef.current = true;
        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = maxScroll * Math.min(1, Math.max(0, percentage));
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 50);
      },

      scrollToHeading(id: string) {
        const container = containerRef.current;
        if (!container) return;
        const el = container.querySelector(`[id="${id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    }));

    // Trigger mermaid rendering when HTML updates
    useEffect(() => {
      if (!containerRef.current) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "strict",
      });

      const mermaidDivs = containerRef.current.querySelectorAll(".mermaid");
      if (mermaidDivs.length > 0) {
        try {
          mermaid.run({
            nodes: Array.from(mermaidDivs) as HTMLElement[],
          });
        } catch {
          // ignore mermaid parse errors on partial typing
        }
      }
    }, [renderedHtml, isDark]);

    // Render Graphviz sources to inline SVG, loading the engine lazily.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const sources = Array.from(
        container.querySelectorAll<HTMLElement>(".graphviz-src"),
      );
      if (sources.length === 0) return;

      let cancelled = false;
      void (async () => {
        try {
          const { instance } = await import("@viz-js/viz");
          const viz = await instance();
          if (cancelled) return;
          for (const source of sources) {
            const code = source.textContent ?? "";
            try {
              // The default output format is dot; ask for SVG explicitly.
              const svg = viz.render(code, { format: "svg" });
              source.classList.remove("graphviz-src");
              source.classList.add("graphviz-rendered");
              source.innerHTML = svg.output ?? "";
            } catch {
              source.classList.add("graphviz-error");
              source.dataset.error = "Graphviz could not render this diagram.";
            }
          }
        } catch {
          // The engine itself failed to load; sources stay as code.
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [renderedHtml]);

    // Embed Excalidraw scenes as view-only islands, lazily loaded.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const embeds = Array.from(
        container.querySelectorAll<HTMLElement>(".excalidraw-embed"),
      );
      if (embeds.length === 0) return;

      let cancelled = false;
      const roots: Array<{
        root: ReturnType<typeof createRoot>;
        node: HTMLElement;
      }> = [];

      void (async () => {
        try {
          const { Excalidraw, React } = await import("./excalidrawIsland");
          if (cancelled) return;
          for (const embed of embeds) {
            let scene: unknown;
            try {
              scene = JSON.parse(embed.textContent ?? "");
            } catch {
              embed.classList.add("graphviz-error");
              embed.dataset.error = "This Excalidraw scene is not valid JSON.";
              continue;
            }
            const host = document.createElement("div");
            host.className = "excalidraw-island";
            embed.replaceWith(host);
            const root = createRoot(host);
            roots.push({ root, node: host });
            root.render(
              React.createElement(Excalidraw, {
                initialData: scene as Record<string, unknown>,
                viewModeEnabled: true,
                theme: isDark ? "dark" : "light",
              }),
            );
          }
        } catch {
          // The island bundle failed to load; embeds stay as code.
        }
      })();

      return () => {
        cancelled = true;
        for (const { root } of roots) {
          root.unmount();
        }
      };
    }, [renderedHtml, isDark]);

    // Handle scroll event
    const handleScroll = () => {
      if (isProgrammaticScrollRef.current || !containerRef.current || !onScroll)
        return;
      const el = containerRef.current;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) {
        onScroll(el.scrollTop / maxScroll);
      }
    };

    // Handle clicks on comment highlights and external links
    const handleClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      if (handleTaskToggle(target, onToggleTask)) {
        e.preventDefault();
        return;
      }

      // Check if user clicked a comment highlight mark
      const commentMark = target.closest(".comment-highlight");
      if (commentMark) {
        const commentId = commentMark.getAttribute("data-comment-id");
        if (commentId && onSelectComment) {
          onSelectComment(commentId);
          return;
        }
      }

      // Relative links open Markdown files in the same Drive folder
      const docLink = target.closest("a.doc-link");
      if (docLink) {
        e.preventDefault();
        const docTarget = (docLink as HTMLElement).dataset.docLink;
        if (docTarget && onOpenDocLink) onOpenDocLink(docTarget);
        return;
      }

      // Wikilinks resolve against the folder like relative links
      const wikilink = target.closest("a.wikilink");
      if (wikilink) {
        e.preventDefault();
        const wikiTarget = (wikilink as HTMLElement).dataset.wikilink;
        if (wikiTarget && onOpenDocLink) onOpenDocLink(wikiTarget);
        return;
      }

      // Open links in new tab
      const anchor = target.closest("a");
      if (anchor && anchor.href && !anchor.href.startsWith("#")) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
    };

    return (
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClick={handleClick}
        style={{ fontSize: `${fontSize}px` }}
        className="preview-pane w-full h-full overflow-y-auto px-8 py-6 text-slate-800 dark:text-slate-100"
      >
        <div
          className="markdown-body max-w-4xl mx-auto"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    );
  },
);

MarkdownPreview.displayName = "MarkdownPreview";

/**
 * Extracts headings from markdown source for Table of Contents
 */
export function extractOutline(markdownText: string): OutlineItem[] {
  const lines = markdownText.split("\n");
  const items: OutlineItem[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const [, hashes, heading] = match;
      if (!hashes || !heading) return;
      const level = hashes.length;
      const text = heading.trim();
      const id = encodeURIComponent(
        text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-"),
      );

      items.push({
        id,
        text,
        level,
        line: index + 1,
      });
    }
  });

  return items;
}
