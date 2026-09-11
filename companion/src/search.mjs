// Cross-document search index. Clients push the Markdown content of
// files they open or save; queries return ranked hits. The index lives
// in memory with optional JSONL persistence, and exists only at the
// organization's own companion deployment, which is how the
// zero-custody promise stays intact.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Restores previously indexed documents from the JSONL persistence
// file; unreadable or malformed content yields an empty index.
const loadPersistedIndex = (persistPath) => {
  const documents = new Map();
  if (!persistPath || !existsSync(persistPath)) return documents;
  try {
    for (const line of readFileSync(persistPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (
          entry?.fileId &&
          typeof entry.name === "string" &&
          entry.termCounts &&
          typeof entry.termCounts === "object"
        ) {
          documents.set(entry.fileId, entry);
        }
      } catch {
        // Skip malformed lines.
      }
    }
  } catch {
    // Start fresh on unreadable indexes.
  }
  return documents;
};

export const createSearchIndex = (persistPath = "") => {
  // fileId -> { fileId, name, nameTerms, terms, termCounts, updatedAt }
  const documents = loadPersistedIndex(persistPath);

  const tokenize = (text) =>
    text
      .toLowerCase()
      .split(/[^a-z0-9\u00c0-\u024f]+/)
      .filter((term) => term.length > 1);

  const persist = () => {
    if (!persistPath) return;
    try {
      writeFileSync(
        persistPath,
        [...documents.values()]
          .map((entry) => JSON.stringify(entry))
          .join("\n") + "\n",
      );
    } catch {
      // Persistence failures never break the request path.
    }
  };

  return {
    index(fileId, { name, content }) {
      const terms = tokenize(content);
      const termCounts = {};
      for (const term of terms) {
        termCounts[term] = (termCounts[term] ?? 0) + 1;
      }
      documents.set(fileId, {
        fileId,
        name,
        nameTerms: tokenize(name),
        termCounts,
        // A short raw excerpt powers result snippets.
        excerpt: content.slice(0, 400),
        updatedAt: new Date().toISOString(),
      });
      persist();
    },

    remove(fileId) {
      documents.delete(fileId);
      persist();
    },

    size() {
      return documents.size;
    },

    // Ranked hits: term frequency with a name boost, every query term
    // must appear (AND semantics keep results precise).
    query(queryText) {
      const terms = tokenize(queryText);
      if (terms.length === 0) return [];
      const hits = [];
      for (const entry of documents.values()) {
        let score = 0;
        let matchedAll = true;
        for (const term of terms) {
          const count = entry.termCounts[term] ?? 0;
          const inName = entry.nameTerms.includes(term);
          if (count === 0 && !inName) {
            matchedAll = false;
            break;
          }
          score += count + (inName ? 5 : 0);
        }
        if (matchedAll) {
          hits.push({
            fileId: entry.fileId,
            name: entry.name,
            score,
            snippet: entry.excerpt.slice(0, 160),
          });
        }
      }
      hits.sort((a, b) => b.score - a.score);
      return hits.slice(0, 20);
    },
  };
};
