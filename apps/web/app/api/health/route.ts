import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

export async function GET() {
  const [dbResult, redisResult, judgeResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    (async () => {
      const redis = getRedis()
      if (!redis) throw new Error('Redis not configured')
      await redis.ping()
    })(),
    prisma.judgeToken.findFirst({
      where: {
        isActive: true,
        lastSeenAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      select: { name: true },
    }),
  ])

  const checks: Record<string, 'ok' | 'error' | 'unavailable'> = {
    db:    dbResult.status    === 'fulfilled' ? 'ok'    : 'error',
    redis: redisResult.status === 'fulfilled' ? 'ok'    : 'error',
    judge: judgeResult.status === 'fulfilled' && judgeResult.value !== null
      ? 'ok'
      : 'unavailable',
  }

  const hasError   = checks.db === 'error' || checks.redis === 'error'
  const allHealthy = !hasError && checks.judge === 'ok'

  return Response.json(
    {
      status: hasError ? 'error' : allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'unknown',
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  )
}
