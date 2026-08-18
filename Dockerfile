# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci

COPY . .
RUN npm run build \
  && npm run build:server \
  && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/src/database/migrations ./server/src/database/migrations
# Needed by the seed: it resolves product photo URLs from public/images/products.
COPY --from=build /app/public ./public
COPY server/.env.example ./server/.env.example

RUN mkdir -p /app/server/uploads && chown node:node /app/server/uploads

EXPOSE 5000
USER node

# Liveness probe — returns 200 from GET /health once the API is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/server.js"]
