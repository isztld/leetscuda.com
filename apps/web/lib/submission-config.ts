export const SubmissionConfig = {
  // Daily submission limits
  dailyLimitFree:     parseInt(process.env.SUBMISSION_DAILY_LIMIT_FREE     ?? '10'),
  dailyLimitPaid:     parseInt(process.env.SUBMISSION_DAILY_LIMIT_PAID     ?? '0'),  // 0 = unlimited

  // Code size limit (bytes)
  maxCodeSizeBytes:   parseInt(process.env.SUBMISSION_MAX_CODE_BYTES       ?? String(16 * 1024)),

  // Per-minute rate limit (burst protection)
  rateLimitPerMinute: parseInt(process.env.SUBMISSION_RATE_LIMIT_PER_MIN   ?? '5'),

  // Judge timeout
  defaultTimeoutMs:   parseInt(process.env.SUBMISSION_TIMEOUT_MS           ?? '30000'),
  maxTimeoutMs:       parseInt(process.env.SUBMISSION_MAX_TIMEOUT_MS        ?? '60000'),
}
