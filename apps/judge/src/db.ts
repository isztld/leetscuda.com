import { PrismaClient } from '@prisma/client'

// Lazily instantiated so DATABASE_URL is read after dotenv loads env vars
let _prisma: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient()
  }
  return _prisma
}
