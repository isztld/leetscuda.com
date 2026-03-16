import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { SubmissionConfig } from './submission-config'

type ValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string; submissionId?: string }

const SUPPORTED_LANGUAGES = ['cpp', 'yaml']

// Control characters that are not allowed (null bytes, non-printable except tab/LF/CR)
const INVALID_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/

export async function validateSubmission(params: {
  userId: string
  problemId: string
  code: string
  language: string
}): Promise<ValidationResult> {
  const { userId, problemId, code, language } = params

  // a) Code size
  const byteLength = Buffer.byteLength(code, 'utf8')
  if (byteLength > SubmissionConfig.maxCodeSizeBytes) {
    return {
      valid: false,
      code: 'CODE_TOO_LARGE',
      message: `Code exceeds ${Math.round(SubmissionConfig.maxCodeSizeBytes / 1024)}KB limit`,
    }
  }

  // b) Code content — empty or invalid characters
  if (!code.trim()) {
    return { valid: false, code: 'EMPTY_CODE', message: 'Submission cannot be empty' }
  }
  if (INVALID_CHARS_RE.test(code)) {
    return { valid: false, code: 'INVALID_CONTENT', message: 'Code contains invalid characters' }
  }

  // c) Language
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return { valid: false, code: 'UNSUPPORTED_LANGUAGE', message: 'Language not supported' }
  }

  // d) Duplicate pending check
  const existingPending = await prisma.submission.findFirst({
    where: {
      userId,
      problemId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
  })
  if (existingPending) {
    return {
      valid: false,
      code: 'PENDING_SUBMISSION',
      message: 'You already have a pending submission for this problem. Please wait for it to complete.',
      submissionId: existingPending.id,
    }
  }

  // e) Daily limit check
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const [todayCount, user] = await Promise.all([
    prisma.submission.count({ where: { userId, submittedAt: { gte: startOfDay } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ])

  const isPaid = user?.role === 'ADMIN'
  const dailyLimit = isPaid ? SubmissionConfig.dailyLimitPaid : SubmissionConfig.dailyLimitFree

  if (dailyLimit > 0 && todayCount >= dailyLimit) {
    console.log(`[api] LIMIT userId=${userId} daily=${todayCount}/${dailyLimit}`)
    return {
      valid: false,
      code: 'DAILY_LIMIT_REACHED',
      message: `You have reached your daily submission limit (${dailyLimit}/day). Upgrade for unlimited submissions.`,
    }
  }

  // f) Per-minute rate limit via Redis
  const redis = getRedis()
  if (redis) {
    const rateLimitKey = `submission:ratelimit:${userId}`
    const count = await redis.incr(rateLimitKey)
    if (count === 1) {
      await redis.expire(rateLimitKey, 60)
    }
    if (count > SubmissionConfig.rateLimitPerMinute) {
      console.log(`[api] RATELIMIT userId=${userId}`)
      return {
        valid: false,
        code: 'RATE_LIMITED',
        message: 'Too many submissions. Please wait a moment.',
      }
    }
  }

  return { valid: true }
}
