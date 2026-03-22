FROM node:20-alpine

RUN apk add --no-cache docker-cli

# Create non-root user for the judge process itself
RUN addgroup -S judge && adduser -S judge -G judge

WORKDIR /app

# install pnpm
RUN npm install -g pnpm

# copy workspace metadata
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# copy only the judge manifest first (better layer caching)
COPY apps/judge/package.json ./apps/judge/

# install only dependencies needed by judge
RUN pnpm install --frozen-lockfile --filter ./apps/judge...

# copy source code
COPY apps/judge ./apps/judge

# Copy seccomp profiles
RUN mkdir -p /etc/judge
COPY apps/judge/seccomp-judge.json /etc/judge/seccomp-judge.json
COPY apps/judge/seccomp-judge-cuda.json /etc/judge/seccomp-judge-cuda.json

WORKDIR /app/apps/judge

ENV NODE_ENV=production

# The judge process runs as non-root.
# Docker CLI communicates with the daemon via DOCKER_HOST pointing to the socket proxy.
USER judge

CMD ["pnpm", "start"]
