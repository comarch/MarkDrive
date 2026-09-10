// MarkQuire companion service.
//
// One optional, self-hosted service with exactly four capabilities:
// CRDT relay, Drive change webhooks, AI proxy, and a search index.
// Every capability is disabled unless its configuration is present, and
// the SPA never requires this service for P0 or P1 features. See
// docs/SECURITY_MODEL.md for the trust boundary.

import http from "node:http";
import { WebSocketServer } from "ws";
import { setupWSConnection, createRelayState } from "./y-relay.mjs";
import { createAuditLog } from "./audit.mjs";
import { createSearchIndex } from "./search.mjs";
import { createDriveWatch } from "./drive-watch.mjs";
import { createAiProxy } from "./ai-proxy.mjs";
import { createNotifier } from "./integrations.mjs";
import { createConfig } from "./config.mjs";

export const createCompanion = (overrides = {}) => {
  const config = createConfig(overrides);
  const audit = createAuditLog(config.auditLogPath, config.retentionDays);
  const search = createSearchIndex(config.searchIndexPath);
  const notifier = createNotifier(config.slackWebhookUrl, audit);
  const aiProxy = createAiProxy(config.geminiApiKey, config.geminiModel);
  const driveWatch = createDriveWatch(
    config.driveWebhookSecret,
    config.publicUrl,
    config.renewalIntervalMs,
    audit,
  );
  const relayState = createRelayState();

  // Event streams per file: JSON frames (drive-change) to subscribed
  // clients, separate from the binary CRDT relay.
  const eventRooms = new Map(); // fileId -> Set<WebSocket>

  const notifyRoom = (fileId, payload) => {
    if (!fileId) return;
    const clients = eventRooms.get(fileId);
    if (!clients) return;
    for (const peer of clients) {
      if (peer.readyState === peer.OPEN) peer.send(JSON.stringify(payload));
    }
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;
    const send = (status, body, type = "application/json") => {
      res.writeHead(status, { "Content-Type": type });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    const readBody = () =>
      new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
          if (data.length > 5_000_000) req.destroy();
        });
        req.on("end", () => {
          try {
            resolve(data.length ? JSON.parse(data) : {});
          } catch {
            resolve(null);
          }
        });
      });

    if (req.method === "GET" && path === "/healthz") {
      return send(200, {
        ok: true,
        capabilities: {
          relay: true,
          driveWatch: driveWatch.isEnabled(),
          aiProxy: aiProxy.isEnabled(),
          search: true,
          integrations: notifier.isEnabled(),
        },
      });
    }

    // AI proxy: the Gemini generateContent contract, key stays server side.
    if (req.method === "POST" && path === "/v1/ai/generate") {
      if (!aiProxy.isEnabled()) return send(503, { error: "AI proxy is not configured." });
      const body = await readBody();
      if (body === null) return send(400, { error: "Invalid JSON body." });
      const result = await aiProxy.generate(body);
      if (result.ok) return send(200, result.payload);
      return send(result.status ?? 502, { error: result.error });
    }

    // Drive webhook target for changes.watch notifications.
    if (req.method === "POST" && path === "/v1/drive/notify") {
      const token = req.headers["x-goog-channel-token"];
      const channelId = req.headers["x-goog-channel-id"];
      const verified = driveWatch.verifyNotification(String(token ?? ""));
      if (!verified) {
        audit.record("drive.notify.rejected", { channelId: String(channelId ?? "unknown") });
        return send(403, { error: "Unknown webhook token." });
      }
      const fileId = driveWatch.fileIdForChannel(String(channelId ?? ""));
      audit.record("drive.notify", { channelId, fileId });
      notifyRoom(fileId, { type: "drive-change", fileId });
      await notifier.notify({
        event: "drive.file.changed",
        fileId,
        text: `MarkQuire: a Drive document changed${fileId ? ` (${fileId})` : ""}.`,
      });
      return send(200, { ok: true });
    }

    // Register a changes.watch channel for a file. The client supplies
    // its own short-lived access token; the companion never persists it.
    if (req.method === "POST" && path === "/v1/drive/watch") {
      if (!driveWatch.isEnabled()) return send(503, { error: "Drive webhooks are not configured." });
      const body = await readBody();
      if (body === null || typeof body.fileId !== "string" || typeof body.accessToken !== "string") {
        return send(400, { error: "fileId and accessToken are required." });
      }
      const result = await driveWatch.register(body.fileId, body.accessToken);
      if (result.ok) {
        audit.record("drive.watch.registered", { fileId: body.fileId, expiresAt: result.expiresAt });
        return send(200, { channelId: result.channelId, expiresAt: result.expiresAt });
      }
      audit.record("drive.watch.failed", { fileId: body.fileId, error: result.error });
      return send(result.status ?? 502, { error: result.error });
    }

    // Search index: clients push documents, queries return ranked hits.
    if (req.method === "POST" && path === "/v1/search/index") {
      const body = await readBody();
      if (body === null || typeof body.fileId !== "string" || typeof body.content !== "string") {
        return send(400, { error: "fileId and content are required." });
      }
      search.index(body.fileId, {
        name: typeof body.name === "string" ? body.name : body.fileId,
        content: body.content,
      });
      audit.record("search.indexed", { fileId: body.fileId });
      return send(200, { ok: true });
    }
    if (req.method === "GET" && path === "/v1/search") {
      const query = url.searchParams.get("q") ?? "";
      return send(200, { query, results: search.query(query) });
    }

    // Integrations fan-out (Slack ships built-in; Teams, Jira, Linear,
    // and git sync plug in at the deployment boundary).
    if (req.method === "POST" && path === "/v1/integrations/notify") {
      if (!notifier.isEnabled()) return send(503, { error: "Integrations are not configured." });
      const body = await readBody();
      if (body === null || typeof body.event !== "string") {
        return send(400, { error: "event is required." });
      }
      const delivered = await notifier.notify({
        event: body.event,
        fileId: typeof body.fileId === "string" ? body.fileId : undefined,
        text: typeof body.text === "string" ? body.text : body.event,
      });
      return send(delivered ? 200 : 502, { ok: delivered });
    }

    // Audit log export for compliance review.
    if (req.method === "GET" && path === "/v1/audit/export") {
      const since = url.searchParams.get("since");
      return send(200, audit.export(since), "application/x-ndjson");
    }
    if (req.method === "GET" && path === "/v1/audit/stats") {
      return send(200, audit.stats());
    }

    return send(404, { error: "Not found." });
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const room = url.searchParams.get("room") ?? "";
    if (room.length === 0) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (url.pathname === "/ws") {
        // Binary CRDT and awareness relay for collaborative editing.
        setupWSConnection(ws, room, relayState, {
          onJoin: (joined) => audit.record("relay.join", { room: joined }),
          onLeave: (left) => audit.record("relay.leave", { room: left }),
        });
      } else if (url.pathname === "/events") {
        // JSON event stream: Drive change pushes and heartbeats.
        const clients = eventRooms.get(room) ?? new Set();
        clients.add(ws);
        eventRooms.set(room, clients);
        ws.on("close", () => {
          clients.delete(ws);
          if (clients.size === 0) eventRooms.delete(room);
        });
        ws.on("message", (data, isBinary) => {
          if (isBinary) return;
          try {
            const message = JSON.parse(data.toString());
            if (message?.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
          } catch {
            // Ignore malformed frames.
          }
        });
        ws.send(JSON.stringify({ type: "welcome", room }));
      } else {
        ws.close();
      }
    });
  });

  const close = () => {
    driveWatch.stop();
    return new Promise((resolve) => {
      wss.close(() => {
        // Keep-alive HTTP connections would otherwise hold close() open.
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    });
  };

  return { server, audit, search, notifier, aiProxy, driveWatch, relayState, eventRooms, notifyRoom, close };
};

// Entry point: bind the listener when run as a script.
if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  const companion = createCompanion();
  const port = Number(process.env.PORT ?? 8787);
  companion.server.listen(port, () => {
    console.log(`MarkQuire companion listening on port ${port}`);
  });
}
