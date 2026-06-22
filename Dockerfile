# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install root (server) deps including dev (needed for tsc/vite build).
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy sources and build both client and server.
COPY . .
RUN npm run build

# Drop dev dependencies for a lean runtime.
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "dist/server/index.js"]
