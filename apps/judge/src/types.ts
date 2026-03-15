import { z } from 'zod'

export const TestCaseSchema = z.object({
  input: z.string(),
  expected: z.string(),
})

export const JudgeJobSchema = z.object({
  submissionId: z.string(),
  problemSlug: z.string(),
  code: z.string(),
  language: z.literal('cpp'),
  runtime: z.enum(['cpp', 'cuda']),
  cppStandard: z.enum(['14', '17', '20', '23']),
  cudaVersion: z.string().optional(),
  computeCap: z.string().optional(),
  testCases: z.array(TestCaseSchema),
  timeoutMs: z.number().int().positive(),
})

export type TestCase = z.infer<typeof TestCaseSchema>
export type JudgeJob = z.infer<typeof JudgeJobSchema>

export type JudgeResult = {
  submissionId: string
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'TIME_LIMIT'
  runtimeMs: number
  output?: string
  errorMsg?: string
  cppStandard?: string
  cudaVersion?: string
  computeCap?: string
}
