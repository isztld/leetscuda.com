import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedis(): Redis | null {
  if (redis) return redis
  if (!process.env.REDIS_URL) return null
  redis = new Redis(process.env.REDIS_URL)
  return redis
}
