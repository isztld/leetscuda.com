import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Lazily instantiated so DATABASE_URL is read after dotenv loads env vars
let _prisma: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
    _prisma = new PrismaClient({ adapter })
  }
  return _prisma
}
