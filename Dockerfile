# syntax=docker/dockerfile:1

# Dependencies stage
FROM node:24.12-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-update-notifier --omit=dev

# Build stage
FROM node:24.12-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-update-notifier
COPY . ./
RUN npm run build

# Runtime stage
FROM node:24.12-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN chown -R 1001:0 /app && chmod -R g=u /app
USER 1001

CMD ["node", "dist/main.js"]
