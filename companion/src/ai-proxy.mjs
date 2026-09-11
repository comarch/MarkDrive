// AI proxy: the companion connection mode from the assistant settings.
// The Gemini key lives on the server; the browser sends only the
// generateContent request it would otherwise send directly.

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.0-flash";

export const createAiProxy = (
  apiKey = "",
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch,
) => {
  const isEnabled = () => apiKey.length > 0;

  const generate = async (payload) => {
    if (!isEnabled()) {
      return { ok: false, status: 503, error: "AI proxy is not configured." };
    }
    if (
      payload === null ||
      typeof payload !== "object" ||
      !Array.isArray(payload.contents)
    ) {
      return {
        ok: false,
        status: 400,
        error: "A Gemini generateContent body is required.",
      };
    }
    const modelName =
      typeof payload.model === "string" && payload.model.length > 0
        ? payload.model
        : model;
    try {
      const response = await fetchImpl(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: payload.contents,
            systemInstruction: payload.systemInstruction,
          }),
        },
      );
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: `Gemini returned ${response.status}.`,
        };
      }
      const json = await response.json();
      return { ok: true, payload: json };
    } catch (error) {
      return { ok: false, error: `Gemini request failed: ${String(error)}` };
    }
  };

  return { isEnabled, generate };
};
