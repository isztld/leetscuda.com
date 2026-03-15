import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export type AuthenticatedJudge = {
  id: string
  name: string
  capabilities: string[]
}

/**
 * Authenticate a judge node from the Bearer token in the Authorization header.
 *
 * Tokens are stored as SHA-256 hashes (industry standard for API tokens —
 * bcrypt is not used because SHA-256 enables deterministic lookup).
 * crypto.timingSafeEqual is used to prevent timing attacks.
 *
 * Returns the judge record on success, or null if the token is missing/invalid/revoked.
 */
export async function authenticateJudge(req: NextRequest): Promise<AuthenticatedJudge | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const rawToken = authHeader.slice(7).trim()
  if (!rawToken.startsWith('jt_')) return null

  // Hash the incoming token to compare against stored hash
  const incomingHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  // Look up the judge token by hash
  const judgeToken = await prisma.judgeToken.findUnique({
    where: { token: incomingHash },
  })

  if (!judgeToken || !judgeToken.isActive) return null

  // Timing-safe comparison as a defence-in-depth measure
  const storedBuf = Buffer.from(judgeToken.token, 'hex')
  const incomingBuf = Buffer.from(incomingHash, 'hex')
  if (storedBuf.length !== incomingBuf.length) return null
  if (!crypto.timingSafeEqual(storedBuf, incomingBuf)) return null

  // Update lastSeenAt (non-blocking — don't await)
  prisma.judgeToken
    .update({ where: { id: judgeToken.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {})

  return {
    id: judgeToken.id,
    name: judgeToken.name,
    capabilities: judgeToken.capabilities,
  }
}
