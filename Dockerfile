# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:1.31.5-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# Rendered to conf.d/default.conf by the image entrypoint so the
# companion resolver can be derived from the runtime resolv.conf.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Opt in to the entrypoint script that exports NGINX_LOCAL_RESOLVERS
# from resolv.conf for the template above.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
