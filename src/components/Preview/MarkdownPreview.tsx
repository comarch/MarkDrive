import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from "react";
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
  onScroll?: (percentage: number) => void;
  onSelectComment?: (commentId: string) => void;
  onToggleTask?: (lineNumber: number, checked: boolean) => void;
}

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
    { content, comments = [], isDark, onScroll, onSelectComment, onToggleTask },
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

      const checkbox = target.closest("input.task-list-item-checkbox");
      if (checkbox) {
        e.preventDefault();
        const lineAttr = checkbox.getAttribute("data-task-line");
        if (!lineAttr || !onToggleTask) return;
        const lineNumber = Number.parseInt(lineAttr, 10);
        if (!Number.isFinite(lineNumber)) return;
        const currentChecked = checkbox.hasAttribute("checked");
        onToggleTask(lineNumber, !currentChecked);
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
        className="preview-pane w-full h-full overflow-y-auto px-8 py-6 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
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
