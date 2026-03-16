import { defineConfig } from 'prisma/config'
import { readFileSync } from 'node:fs'

// Prisma 7 no longer auto-loads .env before evaluating prisma.config.ts
try {
  for (const line of readFileSync('.env', 'utf-8').split('\n')) {
    const m = line.match(/^([^#\s][^=]*)=(.*)$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'tsx --env-file=.env prisma/seed.ts',
  },
})
