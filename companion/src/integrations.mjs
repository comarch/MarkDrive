// Integrations fan-out. Review activity reaches the tools a team
// already watches; Slack ships as the built-in delivery, and Teams,
// Jira, Linear, and git sync plug into the same notify call at the
// deployment boundary (they need org credentials and review).

export const createNotifier = (
  slackWebhookUrl = "",
  audit = null,
  fetchImpl = globalThis.fetch,
) => {
  const isEnabled = () => slackWebhookUrl.length > 0;

  const notify = async ({ event, fileId, text }) => {
    if (!isEnabled()) return false;
    try {
      const response = await fetchImpl(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text ?? `MarkQuire event: ${event}` }),
      });
      const delivered = response.ok;
      audit?.record(
        delivered ? "integrations.delivered" : "integrations.failed",
        {
          event,
          fileId,
          status: response.status,
        },
      );
      return delivered;
    } catch (error) {
      audit?.record("integrations.failed", {
        event,
        fileId,
        error: String(error),
      });
      return false;
    }
  };

  return { isEnabled, notify };
};
