import { z } from 'zod'

// ─── Job schemas ─────────────────────────────────────────────────────────────

export const TestCaseSchema = z.object({
  input: z.string(),
  expected: z.string(),
})

export const CppJudgeJobSchema = z.object({
  submissionId: z.string(),
  problemSlug: z.string(),
  code: z.string(),
  harness: z.string(),
  language: z.literal('cpp'),
  runtime: z.enum(['cpp', 'cuda']),
  cppStandard: z.enum(['14', '17', '20', '23']),
  /** Minimum CUDA toolkit version required (e.g. "13.0"). cuda runtime only. */
  cudaMinVersion: z.string().optional(),
  /** Minimum compute capability required (e.g. "sm_120"). cuda runtime only. */
  computeMinCap: z.string().optional(),
  testCases: z.array(TestCaseSchema).min(1),
  /** Requested per-test-case wall-clock limit in ms. Clamped by JUDGE_MAX_TIMEOUT_MS. */
  timeoutMs: z.number().int().positive(),
})

// ─── Result schemas ───────────────────────────────────────────────────────────

export const SubmissionStatusSchema = z.enum([
  'ACCEPTED',
  'WRONG_ANSWER',
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'TIME_LIMIT',
])

export const JudgeResultSchema = z.object({
  submissionId: z.string(),
  status: SubmissionStatusSchema,
  /** Wall-clock time of the slowest passing test case in ms. */
  runtimeMs: z.number().int().nonnegative(),
  /** Human-readable error detail (compiler diagnostics, crash message, etc.). */
  errorMsg: z.string().optional(),
  testResults: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        passed: z.boolean(),
        input: z.string(),
        expected: z.string(),
        actual: z.string(),
        runtimeMs: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  cppStandard: z.string().optional(),
})

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type TestCase = z.infer<typeof TestCaseSchema>
export type CppJudgeJob = z.infer<typeof CppJudgeJobSchema>
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>
export type JudgeResult = z.infer<typeof JudgeResultSchema>

export type SubmissionTestResult = {
  index: number
  passed: boolean
  input: string
  expected: string
  actual: string
  runtimeMs: number
}
