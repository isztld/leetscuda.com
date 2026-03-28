import { z } from 'zod'

// ─── Check schemas ────────────────────────────────────────────────────────────

export const TestCaseSchema = z.object({
  input: z.string(),
  expected: z.string(),
})

/**
 * A single check to run against the submitted YAML manifest.
 *
 * type: "schema"          — validates kind/apiVersion presence (§6.2)
 * type: "assertion"       — validates a field value via JSONPath + operator (§6.3)
 * type: "kubectl-dry-run" — validates with kubeconform offline schema (§6.4)
 */
export const K8sCheckSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    description: z.string(),
    type: z.literal('schema'),
    /** Fields to assert on any document in the multi-doc manifest. */
    assert: z.object({
      kind: z.string(),
      apiVersion: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string(),
    description: z.string(),
    type: z.literal('assertion'),
    /** JSONPath-style dot/bracket path into the parsed document (§7). */
    path: z.string(),
    /** Comparison operator (§8). */
    op: z.enum(['eq', 'neq', 'exists', 'contains', 'matches', 'gte', 'lte', 'gt', 'lt']),
    /** Expected value. Not required for the "exists" operator. */
    value: z.unknown().optional(),
  }),
  z.object({
    id: z.string(),
    description: z.string(),
    /** Historical name — does NOT invoke kubectl; runs kubeconform offline (§6.4). */
    type: z.literal('kubectl-dry-run'),
  }),
])

// ─── Job schema ───────────────────────────────────────────────────────────────

export const K8sJudgeJobSchema = z.object({
  submissionId: z.string(),
  problemSlug: z.string(),
  /** The user's submitted YAML (single- or multi-document). */
  code: z.string(),
  /** When true, the manifest is parsed as a multi-document YAML stream. */
  k8sMultiDoc: z.boolean().default(false),
  /** Ordered list of checks to evaluate against the parsed manifest. */
  k8sChecks: z.array(K8sCheckSchema).min(1),
  /** Requested wall-clock limit for kubeconform in ms. Clamped by JUDGE_MAX_TIMEOUT_MS. */
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
  /** Always 0 for k8s validation (in-process, effectively instantaneous). */
  runtimeMs: z.number().int().nonnegative(),
  /** Human-readable error detail for RUNTIME_ERROR cases. */
  errorMsg: z.string().optional(),
  /**
   * Per-check results rendered as test cases in the web app's checklist UI.
   *
   * Mapping:
   *   input    → checkId
   *   expected → check description
   *   actual   → validator message (pass message or failure detail)
   *   runtimeMs → 0
   */
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
})

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type TestCase = z.infer<typeof TestCaseSchema>
export type K8sCheck = z.infer<typeof K8sCheckSchema>
export type K8sJudgeJob = z.infer<typeof K8sJudgeJobSchema>
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

/** Per-check result returned by each validator function in the pipeline. */
export type K8sValidationResult = {
  checkId: string
  description: string
  passed: boolean
  message: string
}
