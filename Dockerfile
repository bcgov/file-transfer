# syntax=docker/dockerfile:1
#
# Goals:
# - Deterministic builds (npm ci)
# - Better layer caching (copy lockfiles first)
# - Node version consistency (build + runtime)
# - Distroless-compatible (no curl/shell, no Docker HEALTHCHECK)
# - Run as non-root

# ----------------------------
# 1) Base metadata (keep versions consistent)
# ----------------------------
# If you MUST stay on Node 24, use a Node 24 runtime image too.
# Distroless "nodejs22" will mismatch Node 24 build output / native deps.
# Easiest safe fix: build with Node 22 to match distroless nodejs22 runtime.
ARG NODE_VERSION=22

# ----------------------------
# 2) Dependencies stage (prod deps only)
# ----------------------------
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app

# Prisma target only matters if Prisma is used. Keep if your app needs it.
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

# Copy only package files first to maximize Docker cache hit
COPY package.json package-lock.json ./

# Install production dependencies only
# - omit dev deps (smaller runtime)
# - ignore-scripts is optional: only keep it if you know you don't need lifecycle scripts
RUN npm ci --no-update-notifier --omit=dev

# ----------------------------
# 3) Build stage (dev deps + compile/generate)
# ----------------------------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

# Copy package files and install FULL deps needed to build/test/compile
COPY package.json package-lock.json ./
RUN npm ci --no-update-notifier

# Now copy the rest of the source
COPY . ./

# Build/compile your app. Prefer explicit build step over "deploy"
# - If your repo truly uses `npm run deploy` to generate + build, keep it.
# - Otherwise switch to the script that actually compiles Nest (usually `npm run build`)
RUN npm run deploy

# ----------------------------
# 4) Runtime stage (distroless)
# ----------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot

# Runtime env
ENV NODE_ENV=production
WORKDIR /app

# Copy prod node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy build outputs only (keep runtime small)
# - Adjust these paths if your build outputs differ
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated

#HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/api


# Distroless already runs as nonroot user, but leaving for clarity
USER nonroot

# IMPORTANT:
# Ensure the entry file exists먿ཐ
# Most Nest builds output dist/main.js (or dist/api/main.js).
# Update if your actual output is different.
CMD ["--max-old-space-size=50", "/app/dist/main.js"]
