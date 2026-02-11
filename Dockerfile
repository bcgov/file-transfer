# syntax=docker/dockerfile:1


# 1 Dependencies stage

FROM node:24.12-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-update-notifier --omit=dev

# 2 Build stage (Nest + Java compile)
FROM node:24.12-slim AS build

WORKDIR /app

# ---- Install JDK for compilation ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
 && rm -rf /var/lib/apt/lists/*

# ---- Nest.js build ----
COPY package.json package-lock.json ./
RUN npm ci --no-update-notifier
COPY . .
RUN npm run build

# ---- Entrust Toolkit paths ----
WORKDIR /opt/ent-toolkit

# Copy Entrust jar
COPY ent-toolkit/lib/enttoolkit.jar ./lib/

# Copy Java source
COPY ent-toolkit/src ./src

# Create output directory
RUN mkdir -p classes

# ---- Compile Encode.java ----
RUN javac \
  -cp "./lib/enttoolkit.jar" \
  -d ./classes \
  ./src/com/entrust/toolkit/examples/pkcs7/*.java

# 3️ Runtime stage (lean)
FROM node:24.12-slim

ENV NODE_ENV=production
WORKDIR /app

# ---- Runtime tools + JRE only ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    iputils-ping \
    telnet \
    nano \
    ftp \
    lftp \
    openjdk-17-jre-headless \
 && rm -rf /var/lib/apt/lists/*

# ---- Copy Nest.js runtime ----
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# ---- Copy Entrust Toolkit runtime ----
COPY --from=build /opt/ent-toolkit /opt/ent-toolkit

# ---- Permissions ----
RUN chown -R 1001:0 /app /opt/ent-toolkit \
 && chmod -R g=u /app /opt/ent-toolkit

USER 1001

CMD ["node", "dist/main.js"]
