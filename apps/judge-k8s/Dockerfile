# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN corepack enable && pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ src/

RUN pnpm build

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ARG KUBECONFORM_VERSION=0.6.7

# Install kubeconform from the official GitHub release (statically compiled,
# includes bundled Kubernetes schemas — no network access at runtime).
RUN apk add --no-cache curl \
    && curl -sSL \
        "https://github.com/yannh/kubeconform/releases/download/v${KUBECONFORM_VERSION}/kubeconform-linux-amd64.tar.gz" \
        | tar -xzf - -C /usr/local/bin kubeconform \
    && chmod +x /usr/local/bin/kubeconform \
    && apk del curl

WORKDIR /app

# Copy compiled output and production deps only
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Non-root user (uid 1001) — matches §15 / §10 of ARCHITECTURE.md
RUN addgroup -S judge && adduser -S -u 1001 -G judge judge
USER 1001

# The entire filesystem is read_only at runtime (docker-compose.yml / k8s).
# Only /tmp is writable (tmpfs mount). kubeconform writes temp files there (§6.4).
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
