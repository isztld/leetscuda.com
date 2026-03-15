FROM node:20-alpine

RUN apk add --no-cache docker-cli

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

WORKDIR /app/apps/judge

ENV NODE_ENV=production

CMD ["pnpm", "start"]