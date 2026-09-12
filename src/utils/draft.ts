import { safeGetItem, safeSetItem } from "./safeStorage";

const DRAFT_KEY = "gdrive_md_draft";
const LEGACY_TITLE_KEY = "gdrive_md_last_title";
const LEGACY_CONTENT_KEY = "gdrive_md_last_content";

export interface PersistedDraft {
  title: string;
  content: string;
}

/**
 * Persists the recoverable draft as one JSON pair. Storing the title and
 * content separately let a reload recombine a stale title from one
 * document with the newer content of another; the pair keeps them
 * consistent across sessions.
 */
export function persistDraft(title: string, content: string): void {
  safeSetItem(DRAFT_KEY, JSON.stringify({ title, content }));
}

/**
 * Reads the persisted draft. The title/content pair is authoritative;
 * the legacy split keys are honored once so pre-pair drafts survive the
 * first reload after the upgrade.
 */
export function readPersistedDraft(
  defaultTitle: string,
  defaultContent: string,
): PersistedDraft {
  try {
    const raw = safeGetItem(DRAFT_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const { title, content } = parsed as Record<string, unknown>;
        if (typeof title === "string" && typeof content === "string") {
          return { title, content };
        }
      }
    }
  } catch {
    // Malformed pairs fall through to the legacy keys.
  }

  return {
    title: safeGetItem(LEGACY_TITLE_KEY) || defaultTitle,
    content: safeGetItem(LEGACY_CONTENT_KEY) || defaultContent,
  };
}
