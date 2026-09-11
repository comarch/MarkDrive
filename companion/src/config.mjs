// Companion configuration. Every capability is off unless its piece of
// configuration exists, so a default deployment serves only the health
// check and the relay. Overrides (used by tests) share the environment
// variable names as keys.

export const createConfig = (overrides = {}) => {
  const env = process.env;
  const value = (key, fallback) =>
    key in overrides ? overrides[key] : (env[key] ?? fallback);

  return {
    port: Number(value("PORT", 8787)),
    // Public HTTPS base Drive calls back into, for example
    // https://markquire.example.invalid
    publicUrl: String(value("PUBLIC_URL", "")),
    // Shared secret between this service and the SPA's webhook tokens.
    driveWebhookSecret: String(value("DRIVE_WEBHOOK_SECRET", "")),
    // Server-side Gemini key; never sent to the browser.
    geminiApiKey: String(value("GEMINI_API_KEY", "")),
    geminiModel: String(value("GEMINI_MODEL", "gemini-2.0-flash")),
    // Slack webhook URL for the integrations fan-out.
    slackWebhookUrl: String(value("SLACK_WEBHOOK_URL", "")),
    // Audit and search persistence (JSONL files under a data directory).
    auditLogPath: String(value("AUDIT_LOG_PATH", "")),
    searchIndexPath: String(value("SEARCH_INDEX_PATH", "")),
    // Compliance retention: audit entries older than this are pruned.
    retentionDays: Number(value("RETENTION_DAYS", 365)),
    // Watch renewal cadence; Drive channels expire, so renewal must run
    // before they do.
    renewalIntervalMs: Number(value("RENEWAL_INTERVAL_MS", 60 * 60 * 1000)),
  };
};
