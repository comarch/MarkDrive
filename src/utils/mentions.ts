// Mentions in comment bodies. Drive delivers the actual notifications;
// the app only renders them distinctly and never claims to send mail.

export interface MentionSegment {
  text: string;
  isMention: boolean;
}

const MENTION_PATTERN = /@[A-Za-z0-9_.-]+/g;

/**
 * Splits a comment body into plain and mention segments. Mentions are
 * @-prefixed names of letters, digits, dots, underscores, and hyphens.
 */
export function splitMentions(text: string): MentionSegment[] {
  if (!text.includes("@")) return [{ text, isMention: false }];

  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index), isMention: false });
    }
    segments.push({ text: match[0], isMention: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isMention: false });
  }
  return segments;
}
