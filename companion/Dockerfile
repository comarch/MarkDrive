# MarkQuire companion service container.
#
# One optional, self-hosted service: CRDT relay, Drive change webhooks,
# AI proxy, and search index. It is never required for P0 or P1 SPA
# features; a deployment without it keeps every core capability.

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
# --ignore-scripts: the runtime deps (yjs, ws, lib0) ship no required
# lifecycle scripts, so blocking them removes a supply-chain vector.
RUN npm ci --omit=dev --ignore-scripts

COPY src ./src

# Drop to the unprivileged node user; the service needs no root
# capabilities.
USER node

ENV PORT=8787 \
    NODE_ENV=production

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8787/healthz || exit 1

CMD ["node", "src/server.mjs"]
