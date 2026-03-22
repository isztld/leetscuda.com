import { z } from 'zod'

export const TestCaseSchema = z.object({
  input: z.string(),
  expected: z.string(),
})

export const K8sCheckSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(['schema', 'assertion', 'kubectl-dry-run']),
  assert: z.record(z.string(), z.unknown()).optional(),
  path: z.string().optional(),
  op: z.string().optional(),
  value: z.unknown().optional(),
})

export const CppJudgeJobSchema = z.object({
  submissionId: z.string(),
  problemSlug: z.string(),
  code: z.string(),
  harness: z.string(),
  language: z.literal('cpp'),
  runtime: z.enum(['cpp', 'cuda']),
  cppStandard: z.enum(['14', '17', '20', '23']),
  cudaMinVersion: z.string().optional(),
  computeMinCap: z.string().optional(),
  testCases: z.array(TestCaseSchema),
  timeoutMs: z.number().int().positive(),
})

export const K8sJudgeJobSchema = z.object({
  submissionId: z.string(),
  problemSlug: z.string(),
  code: z.string(),
  language: z.literal('yaml'),
  runtime: z.literal('k8s'),
  k8sMultiDoc: z.boolean(),
  k8sChecks: z.array(K8sCheckSchema),
  timeoutMs: z.number().int().positive(),
})

export const JudgeJobSchema = z.discriminatedUnion('runtime', [
  CppJudgeJobSchema,
  K8sJudgeJobSchema,
])

export type TestCase = z.infer<typeof TestCaseSchema>
export type K8sCheck = z.infer<typeof K8sCheckSchema>
export type CppJudgeJob = z.infer<typeof CppJudgeJobSchema>
export type K8sJudgeJob = z.infer<typeof K8sJudgeJobSchema>
export type JudgeJob = z.infer<typeof JudgeJobSchema>

export type SubmissionTestResult = {
  index: number
  passed: boolean
  input: string
  expected: string
  actual: string
  runtimeMs: number
}

export type JudgeResult = {
  submissionId: string
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT'
  runtimeMs: number
  errorMsg?: string
  testResults?: SubmissionTestResult[]
  cppStandard?: string
}
