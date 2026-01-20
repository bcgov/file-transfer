# syntax=docker/dockerfile:1
#
# Goals:
# - Deterministic builds (npm ci)
# - Better layer caching (copy lockfiles first)
# - Node version consistency (build + runtime)
# - Distroless-compatible (no curl/shell, no Docker HEALTHCHECK)
# - Run as non-root

ARG NODE_VERSION=24

# ----------------------------
# 1) Dependencies stage (prod deps only)
# ----------------------------
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app

# Cache-friendly: copy lockfiles first
COPY package.json package-lock.json ./

# Prod deps only (smaller runtime)
RUN npm ci --no-update-notifier --omit=dev

# ----------------------------
# 2) Build stage (full deps + compile)
# ----------------------------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-update-notifier

# Copy source after deps to maximize cache hits
COPY . ./

# Prefer explicit build
# If your repo truly needs `npm run deploy`, swap this back.
RUN npm run build

# ----------------------------
# 3) Runtime stage (distroless)
# ----------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot

ENV NODE_ENV=production
WORKDIR /app

# Copy prod node_modules + build output only
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Only copy if it exists in your repo/output
COPY --from=build /app/generated ./generated

USER nonroot
# Distroless entrypoint is node; CMD is node arguments.
# Adjust path to your real Nest output:
# - common: /app/dist/main.js
# - sometimes: /app/dist/api/main.js
CMD ["--max-old-space-size=50", "/app/dist/main.js"]
