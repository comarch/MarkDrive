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

  const send = (res, status, body, type = "application/json") => {
    res.writeHead(status, { "Content-Type": type });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  const readBody = (req) =>
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

  // Route table: each handler owns one endpoint, so dispatch stays
  // flat and every capability reads as a unit.
  const routes = new Map();

  routes.set("GET /healthz", async ({ res }) => {
    send(res, 200, {
      ok: true,
      capabilities: {
        relay: true,
        driveWatch: driveWatch.isEnabled(),
        aiProxy: aiProxy.isEnabled(),
        search: true,
        integrations: notifier.isEnabled(),
      },
    });
  });

  // AI proxy: the Gemini generateContent contract, key stays server side.
  routes.set("POST /v1/ai/generate", async ({ req, res }) => {
    if (!aiProxy.isEnabled())
      return send(res, 503, { error: "AI proxy is not configured." });
    const body = await readBody(req);
    if (body === null) return send(res, 400, { error: "Invalid JSON body." });
    const result = await aiProxy.generate(body);
    if (result.ok) return send(res, 200, result.payload);
    return send(res, result.status ?? 502, { error: result.error });
  });

  // Drive webhook target for changes.watch notifications.
  routes.set("POST /v1/drive/notify", async ({ req, res }) => {
    const token = req.headers["x-goog-channel-token"];
    const channelId = req.headers["x-goog-channel-id"];
    const verified = driveWatch.verifyNotification(String(token ?? ""));
    if (!verified) {
      audit.record("drive.notify.rejected", {
        channelId: String(channelId ?? "unknown"),
      });
      return send(res, 403, { error: "Unknown webhook token." });
    }
    const fileId = driveWatch.fileIdForChannel(String(channelId ?? ""));
    audit.record("drive.notify", { channelId, fileId });
    notifyRoom(fileId, { type: "drive-change", fileId });
    const suffix = fileId ? ` (${fileId})` : "";
    await notifier.notify({
      event: "drive.file.changed",
      fileId,
      text: `MarkQuire: a Drive document changed${suffix}.`,
    });
    return send(res, 200, { ok: true });
  });

  // Register a changes.watch channel for a file. The client supplies
  // its own short-lived access token; the companion never persists it.
  routes.set("POST /v1/drive/watch", async ({ req, res }) => {
    if (!driveWatch.isEnabled())
      return send(res, 503, { error: "Drive webhooks are not configured." });
    const body = await readBody(req);
    if (
      body === null ||
      typeof body.fileId !== "string" ||
      typeof body.accessToken !== "string"
    ) {
      return send(res, 400, { error: "fileId and accessToken are required." });
    }
    const result = await driveWatch.register(body.fileId, body.accessToken);
    if (result.ok) {
      audit.record("drive.watch.registered", {
        fileId: body.fileId,
        expiresAt: result.expiresAt,
      });
      return send(res, 200, {
        channelId: result.channelId,
        expiresAt: result.expiresAt,
      });
    }
    audit.record("drive.watch.failed", {
      fileId: body.fileId,
      error: result.error,
    });
    return send(res, result.status ?? 502, { error: result.error });
  });

  // Search index: clients push documents, queries return ranked hits.
  routes.set("POST /v1/search/index", async ({ req, res }) => {
    const body = await readBody(req);
    if (
      body === null ||
      typeof body.fileId !== "string" ||
      typeof body.content !== "string"
    ) {
      return send(res, 400, { error: "fileId and content are required." });
    }
    search.index(body.fileId, {
      name: typeof body.name === "string" ? body.name : body.fileId,
      content: body.content,
    });
    audit.record("search.indexed", { fileId: body.fileId });
    return send(res, 200, { ok: true });
  });

  routes.set("GET /v1/search", async ({ res, url }) => {
    const query = url.searchParams.get("q") ?? "";
    return send(res, 200, { query, results: search.query(query) });
  });

  // Integrations fan-out (Slack ships built-in; Teams, Jira, Linear,
  // and git sync plug in at the deployment boundary).
  routes.set("POST /v1/integrations/notify", async ({ req, res }) => {
    if (!notifier.isEnabled())
      return send(res, 503, { error: "Integrations are not configured." });
    const body = await readBody(req);
    if (body === null || typeof body.event !== "string") {
      return send(res, 400, { error: "event is required." });
    }
    const delivered = await notifier.notify({
      event: body.event,
      fileId: typeof body.fileId === "string" ? body.fileId : undefined,
      text: typeof body.text === "string" ? body.text : body.event,
    });
    return send(res, delivered ? 200 : 502, { ok: delivered });
  });

  // Audit log export for compliance review.
  routes.set("GET /v1/audit/export", async ({ res, url }) => {
    const since = url.searchParams.get("since");
    return send(res, 200, audit.export(since), "application/x-ndjson");
  });

  routes.set("GET /v1/audit/stats", async ({ res }) => {
    return send(res, 200, audit.stats());
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const route = routes.get(`${req.method} ${url.pathname}`);
    if (route) {
      await route({ req, res, url });
      return;
    }
    send(res, 404, { error: "Not found." });
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    // y-websocket addresses a room as /ws/<room>; the ?room= form stays
    // supported for custom clients such as the event stream.
    let room = url.searchParams.get("room") ?? "";
    if (room.length === 0 && url.pathname.startsWith("/ws/")) {
      try {
        room = decodeURIComponent(url.pathname.slice(4));
      } catch {
        room = "";
      }
    }
    if (room.length === 0) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (url.pathname === "/ws" || url.pathname.startsWith("/ws/")) {
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
            if (message?.type === "ping")
              ws.send(JSON.stringify({ type: "pong" }));
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

  return {
    server,
    audit,
    search,
    notifier,
    aiProxy,
    driveWatch,
    relayState,
    eventRooms,
    notifyRoom,
    close,
  };
};

// Entry point: bind the listener when run as a script.
if (process.argv[1]?.endsWith("server.mjs")) {
  const companion = createCompanion();
  const port = Number(process.env.PORT ?? 8787);
  companion.server.listen(port, () => {
    console.log(`MarkQuire companion listening on port ${port}`);
  });
}
