FROM node:20-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production

CMD ["pnpm", "start"]
