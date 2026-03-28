# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder
#   Compiles TypeScript to CommonJS in /app/dist.
#   Uses the full Node.js image so tsc is available via the devDependencies.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies — we need tsc).
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Compile TypeScript.
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runner
#   Lean image: Node.js runtime + the Docker CLI client binary only.
#   No Docker daemon, no docker-compose, no buildx.
#
#   Security posture:
#     • Runs as uid 1001 (non-root).
#     • read_only filesystem in compose; /tmp is a tmpfs mount.
#     • The judge never touches /var/run/docker.sock directly — it connects
#       to the docker-socket-proxy sidecar via DOCKER_HOST.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Install the Docker CLI client (not the daemon — no dockerd, no containerd).
# docker-cli is the minimal Alpine package that provides the `docker` binary.
RUN apk add --no-cache docker-cli

# Create a non-root user for the judge process (uid 1001).
RUN addgroup -g 1001 -S judge && \
    adduser  -u 1001 -S judge -G judge

WORKDIR /app

# Copy compiled JS and production node_modules from the builder stage.
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Copy seccomp profiles to the canonical location expected by env.ts and
# build.ts (/etc/judge/seccomp/).  The profiles are also bind-mounted
# read-only from the host in docker-compose.yml so the operator can update
# them without rebuilding the image; the COPY here is a fallback that ensures
# the image is self-contained for offline or CI use.
COPY seccomp/ /etc/judge/seccomp/

# Switch to the non-root judge user.
USER 1001

# Health check via the judge's own HTTP health endpoint (§4, §9).
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://localhost:${JUDGE_HEALTH_PORT:-8080}/" || exit 1

CMD ["node", "dist/main.js"]
