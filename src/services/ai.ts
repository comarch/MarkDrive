// Feature-flagged Gemini assistant. The whole surface is opt-in: the
// build flag compiles it out, the settings keep it off by default, and
// every call sends document content only to the endpoint the user or
// the operator configured. See docs/SECURITY_MODEL.md for the network
// paths and the contract each connection mode implements.

export const AI_BUILD_ENABLED: boolean =
  (import.meta.env.VITE_ENABLE_AI as string | undefined) === "1";

export type AIConnectionMode = "apiKey" | "firebase" | "companion";

export interface AISettings {
  enabled: boolean;
  mode: AIConnectionMode;
  /** Google AI Studio key, stored in browser localStorage. */
  apiKey: string;
  /** Self-hosted Firebase AI Logic proxy URL. */
  firebaseEndpoint: string;
  /** Companion service base URL. */
  companionBaseUrl: string;
  model: string;
}

export const DEFAULT_AI_MODEL = "gemini-2.0-flash";

export const defaultAISettings = (): AISettings => ({
  enabled: false,
  mode: "apiKey",
  apiKey: "",
  firebaseEndpoint: "",
  companionBaseUrl: "",
  model: DEFAULT_AI_MODEL,
});

export type AICommandId =
  | "draft"
  | "rewrite"
  | "shorten"
  | "grammar"
  | "translate"
  | "summarizeDoc"
  | "summarizeThread"
  | "tableFromProse"
  | "mermaidFromDescription"
  | "askDoc"
  | "changelog"
  | "commentToPatch";

export interface AIActionContext {
  /** Full open document. */
  document: string;
  /** Selected text in the editor, if any. */
  selection: string | null;
  /** Open Drive comment threads (body text of each). */
  commentThreads: string[];
  /** Content of the revision selected in the history sidebar, if any. */
  previousRevision: string | null;
}

export interface AIRequestInput {
  command: AICommandId;
  /** Free-form input: topic, question, or prose to convert. */
  input?: string;
}

export interface AIResult {
  ok: boolean;
  text: string;
  error?: string;
}

const SYSTEM_PROMPT = [
  "You are a writing assistant inside a Markdown editor.",
  "Always answer with Markdown only, without commentary or code fences",
  "around the whole answer. Keep the language of the source text.",
].join(" ");

const quote = (text: string, cap = 4000): string =>
  text.length > cap ? text.slice(0, cap) : text;

// Commands driven by what the user typed into the panel input.
const INPUT_PROMPT_COMMANDS = new Set<AICommandId>([
  "draft",
  "tableFromProse",
  "mermaidFromDescription",
  "askDoc",
]);

// Input-driven commands: the prompt is built from the typed input,
// with the document available as context where the command needs it.
const buildInputPrompt = (
  command: AICommandId,
  inputText: string,
  context: AIActionContext,
): string | null => {
  switch (command) {
    case "draft":
      return inputText ? `Draft a Markdown document about: ${inputText}` : null;
    case "tableFromProse":
      return inputText
        ? `Convert this description into a Markdown table. Choose sensible columns:\n\n${quote(inputText)}`
        : null;
    case "mermaidFromDescription":
      return inputText
        ? `Generate a Mermaid diagram (flowchart or sequence) for this description. Output only the Mermaid code in a fenced block:\n\n${quote(inputText)}`
        : null;
    case "askDoc":
      return inputText
        ? `Answer the question using only this document. If the answer is not in it, say so.\n\nQuestion: ${inputText}\n\nDocument:\n${quote(context.document, 8000)}`
        : null;
    default:
      return null;
  }
};

// Polish text translates to English and vice versa; other languages
// default to English.
const buildTranslatePrompt = (target: string): string | null => {
  if (target.length === 0) return null;
  const hasPolish = /[ąćęłńóśźż]/i.test(target);
  const direction = hasPolish ? "Polish to English" : "English to Polish";
  return `Translate this text from ${direction}. Keep Markdown formatting:\n\n${quote(target)}`;
};

// Rewrites the selected text so the reviewer comment is addressed.
const buildCommentToPatchPrompt = (context: AIActionContext): string | null => {
  const thread = context.commentThreads[0];
  if (!thread || context.selection === null) return null;
  return `A reviewer left this comment about the selected text:\n\nComment: ${quote(thread)}\n\nSelected text:\n${quote(context.selection)}\n\nRewrite the selected text so the comment is addressed. Output only the replacement Markdown text.`;
};

// Target-driven commands: the prompt is built from the selection (or
// the whole document), the review thread, or the previous revision.
const buildTargetPrompt = (
  command: AICommandId,
  target: string,
  context: AIActionContext,
): string | null => {
  switch (command) {
    case "rewrite":
      return target.length > 0
        ? `Rewrite this text to be clearer and better structured, keeping its meaning and Markdown formatting:\n\n${quote(target)}`
        : null;
    case "shorten":
      return target.length > 0
        ? `Shorten this text while keeping every key fact. Keep Markdown formatting:\n\n${quote(target)}`
        : null;
    case "grammar":
      return target.length > 0
        ? `Fix grammar, spelling, and punctuation in this text. Change nothing else. Keep Markdown formatting:\n\n${quote(target)}`
        : null;
    case "translate":
      return buildTranslatePrompt(target);
    case "summarizeDoc":
      return context.document.length > 0
        ? `Summarize this document in 5 to 8 Markdown bullet points:\n\n${quote(context.document, 8000)}`
        : null;
    case "summarizeThread": {
      const thread = context.commentThreads[0];
      return thread
        ? `Summarize this review discussion in 3 Markdown bullet points:\n\n${quote(thread)}`
        : null;
    }
    case "changelog":
      return context.previousRevision !== null
        ? `Write a changelog in Markdown between these two versions. Group changes under Added, Changed, Fixed, Removed as needed.\n\nPrevious version:\n${quote(context.previousRevision, 4000)}\n\nCurrent version:\n${quote(context.document, 4000)}`
        : null;
    case "commentToPatch":
      return buildCommentToPatchPrompt(context);
    default:
      return null;
  }
};

// Every command maps to a prompt builder over the action context. The
// builder returns null when the command cannot run (no selection, no
// thread picked, no revision), which surfaces as a user-facing error.
const buildPrompt = (
  command: AICommandId,
  input: string | undefined,
  context: AIActionContext,
): string | null => {
  const target = context.selection ?? context.document;
  const inputText = (input ?? "").trim();
  if (INPUT_PROMPT_COMMANDS.has(command)) {
    return buildInputPrompt(command, inputText, context);
  }
  return buildTargetPrompt(command, target, context);
};

const buildEndpoint = (settings: AISettings): string => {
  const model = settings.model.trim() || DEFAULT_AI_MODEL;
  switch (settings.mode) {
    case "apiKey":
      return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey.trim())}`;
    case "firebase":
      return settings.firebaseEndpoint.trim();
    case "companion":
      return `${settings.companionBaseUrl.replace(/\/$/, "")}/v1/ai/generate`;
  }
};

// The Gemini generateContent response shape; the firebase and companion
// modes pass it through unchanged (see docs/SECURITY_MODEL.md).
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

const parseResponse = (payload: unknown): string => {
  const response = payload as GeminiResponse;
  const text = (response.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  return text;
};

const isConfigured = (settings: AISettings): boolean => {
  switch (settings.mode) {
    case "apiKey":
      return settings.apiKey.trim().length > 0;
    case "firebase":
      return settings.firebaseEndpoint.trim().length > 0;
    case "companion":
      return settings.companionBaseUrl.trim().length > 0;
  }
};

/**
 * Runs one assistant command. Returns ok: false with a user-facing
 * message for every disabled or unconfigured state; it never throws.
 */
export const runAICommand = async (
  settings: AISettings,
  request: AIRequestInput,
  context: AIActionContext,
): Promise<AIResult> => {
  if (!AI_BUILD_ENABLED) {
    return {
      ok: false,
      text: "",
      error: "AI support is compiled out of this build.",
    };
  }
  if (!settings.enabled) {
    return { ok: false, text: "", error: "The AI assistant is off." };
  }
  if (!isConfigured(settings)) {
    return {
      ok: false,
      text: "",
      error: `The ${settings.mode} connection mode is missing its configuration.`,
    };
  }
  const prompt = buildPrompt(request.command, request.input, context);
  if (prompt === null) {
    return {
      ok: false,
      text: "",
      error: "This command has nothing to work on yet.",
    };
  }
  try {
    const response = await fetch(buildEndpoint(settings), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        text: "",
        error: `The AI endpoint returned ${response.status}.`,
      };
    }
    const text = parseResponse(await response.json());
    if (text.length === 0) {
      return {
        ok: false,
        text: "",
        error: "The AI endpoint returned an empty answer.",
      };
    }
    return { ok: true, text };
  } catch {
    return {
      ok: false,
      text: "",
      error: "The AI endpoint could not be reached.",
    };
  }
};

/** Which commands currently have material to work on. */
export const availableCommands = (context: AIActionContext): AICommandId[] => {
  const commands: AICommandId[] = [];
  if (context.document.length > 0) commands.push("summarizeDoc", "askDoc");
  if (context.selection) commands.push("commentToPatch");
  if ((context.selection ?? context.document).length > 0)
    commands.push("rewrite", "shorten", "grammar", "translate");
  if (context.commentThreads.length > 0) commands.push("summarizeThread");
  if (context.previousRevision !== null) commands.push("changelog");
  // The three input-driven commands are always offered.
  commands.push("draft", "tableFromProse", "mermaidFromDescription");
  return commands;
};
