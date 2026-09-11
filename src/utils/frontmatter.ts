import { load as loadYaml, dump as dumpYaml } from "js-yaml";

export interface FrontmatterParseResult {
  /** Full original block including delimiters, empty when absent. */
  raw: string;
  /** Markdown without the frontmatter block. */
  body: string;
  /** Parsed fields; empty when the block is missing or malformed. */
  fields: Record<string, unknown>;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Splits a leading YAML frontmatter block from the Markdown body.
 *
 * The raw block is kept verbatim so an open-edit-save cycle that never
 * touches the properties panel rewrites nothing.
 */
export function parseFrontmatter(markdown: string): FrontmatterParseResult {
  const match = FRONTMATTER_PATTERN.exec(markdown);
  if (!match) {
    return { raw: "", body: markdown, fields: {} };
  }

  const raw = match[0];
  const body = markdown.slice(raw.length);
  let fields: Record<string, unknown> = {};
  try {
    const loaded = loadYaml(match[1] ?? "");
    if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
      fields = loaded as Record<string, unknown>;
    }
  } catch {
    // Malformed YAML stays as raw text; the panel shows nothing editable.
  }

  return { raw, body, fields };
}

/** Number of source lines the frontmatter block occupies. */
export function frontmatterLineOffset(markdown: string): number {
  const { raw } = parseFrontmatter(markdown);
  if (!raw) return 0;
  return raw.split("\n").length - 1;
}

export function serializeFrontmatter(fields: Record<string, unknown>): string {
  const dumped = dumpYaml(fields, { indent: 2, lineWidth: 100 });
  return `---\n${dumped}---\n`;
}

/**
 * Sets one string field and rebuilds the frontmatter block.
 *
 * Key order follows the parsed order, then new keys append at the end.
 */
export function updateFrontmatterField(
  markdown: string,
  key: string,
  value: string,
): string {
  const { body, fields } = parseFrontmatter(markdown);
  const trimmedKey = key.trim();
  if (!trimmedKey) return markdown;
  const next: Record<string, unknown> = { ...fields, [trimmedKey]: value };
  return serializeFrontmatter(next) + body;
}
