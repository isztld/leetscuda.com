import { z } from 'zod'

export const JudgeJobSchema = z.object({
  submissionId: z.string(),
  problemSlug: z.string(),
  code: z.string(),
  language: z.literal('cpp'),
})

export type JudgeJob = z.infer<typeof JudgeJobSchema>
