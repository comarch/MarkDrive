import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2, List } from "lucide-react";
import { parseMarkdown } from "../Preview/markdownParser";
import { slideTitle, splitSlides } from "../../utils/slides";

interface PresentModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

/**
 * Fullscreen slide presentation of the open document.
 */
export const PresentModal: React.FC<PresentModalProps> = ({
  isOpen,
  onClose,
  content,
}) => {
  const slides = useMemo(() => splitSlides(content), [content]);
  const [index, setIndex] = useState(0);
  const [showAgenda, setShowAgenda] = useState(false);

  // Reset to the first slide each time presenting starts.
  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen]);

  // Keyboard navigation.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key.toLowerCase() === "g") {
        setShowAgenda((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, slides.length, onClose]);

  if (!isOpen) return null;

  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm">Nothing to present yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Add content separated by --- breaks to build slides.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Agenda entries get content-based keys so repeated slide texts still
  // produce unique, stable React keys.
  const agendaItems = (() => {
    const seen = new Map<string, number>();
    return slides.map((slide, slideIndex) => {
      const occurrence = (seen.get(slide) ?? 0) + 1;
      seen.set(slide, occurrence);
      return { slide, slideIndex, key: `${slide}#${occurrence}` };
    });
  })();

  const current = slides[index] ?? "";
  const rendered = parseMarkdown(current);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 text-slate-100 flex flex-col">
      {/* Slide canvas */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
        <div
          className="markdown-body slide-stage w-full max-w-3xl text-center"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      </div>

      {/* Agenda overlay */}
      {showAgenda && (
        <div className="absolute inset-0 bg-slate-950/95 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Agenda
            </div>
            <div className="space-y-1">
              {agendaItems.map(({ slide, slideIndex, key }) => (
                <button
                  key={key}
                  onClick={() => {
                    setIndex(slideIndex);
                    setShowAgenda(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition ${
                    slideIndex === index
                      ? "bg-brand-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {slideIndex + 1}. {slideTitle(slide)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 py-3 bg-slate-900/80 border-t border-slate-800">
        <button
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          title="Previous slide (ArrowLeft)"
          className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-30 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xs text-slate-400 font-mono min-w-[64px] text-center">
          {index + 1} / {slides.length}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
          disabled={index === slides.length - 1}
          title="Next slide (ArrowRight)"
          className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-30 transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="h-4 w-px bg-slate-700 mx-1" />
        <button
          onClick={() => setShowAgenda((v) => !v)}
          title="Slide agenda (G)"
          className="p-2 rounded-full hover:bg-slate-800 transition"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => void document.documentElement.requestFullscreen?.()}
          title="Fullscreen"
          className="p-2 rounded-full hover:bg-slate-800 transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          title="Exit presentation (Escape)"
          className="p-2 rounded-full hover:bg-rose-600/80 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
