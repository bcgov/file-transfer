# syntax=docker/dockerfile:1


# 1️ Dependencies stage

FROM node:24.12-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


# 2️ Build stage (Nest + Java + OpenSSL 1.1.1)
FROM node:24.12-slim AS build

WORKDIR /app

# ---- Install build dependencies ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    wget \
    zlib1g-dev \
    openjdk-17-jdk-headless \
 && rm -rf /var/lib/apt/lists/*

# ---- Install OpenSSL 1.1.1w (STATIC build) ----
RUN wget https://www.openssl.org/source/openssl-1.1.1w.tar.gz && \
    tar -xzf openssl-1.1.1w.tar.gz && \
    cd openssl-1.1.1w && \
    ./config --prefix=/opt/openssl-1.1.1 \
             --openssldir=/opt/openssl-1.1.1 \
             no-shared \
             zlib && \
    make -j$(nproc) && \
    make install_sw

# ---- Nest build ----
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# 3️ Runtime stage (Lean Production Image)
FROM node:24.12-slim

ENV NODE_ENV=production
WORKDIR /app

# ---- Runtime tools + JRE only ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre-headless \
    curl \
    iputils-ping \
 && rm -rf /var/lib/apt/lists/*

# ---- Copy OpenSSL 1.1.1 from build ----
COPY --from=build /opt/openssl-1.1.1 /opt/openssl-1.1.1

# Ensure OpenSSL 1.1.1 is used instead of system 3.x
ENV PATH="/opt/openssl-1.1.1/bin:$PATH"

# ---- Copy Nest runtime ----
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# ---- Copy Entrust Toolkit ----
COPY --from=build /opt/ent-toolkit /opt/ent-toolkit

# ---- Permissions ----
RUN chown -R 1001:0 /app /opt/ent-toolkit \
 && chmod -R g=u /app /opt/ent-toolkit

USER 1001

CMD ["node", "dist/main.js"]
