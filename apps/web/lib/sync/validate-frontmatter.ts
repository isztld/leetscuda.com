import { z } from 'zod'

export const ProblemFrontmatterSchema = z
  .object({
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
    title: z.string().min(1),
    track: z.enum(['cuda', 'ml-systems', 'kubernetes-ai', 'foundations']),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    xp: z.number().int().positive(),
    runtime: z.enum(['cpp', 'cuda']),
    cpp_standard: z.enum(['14', '17', '20', '23']),
    cuda_version: z.string().optional(),
    compute_cap: z.string().optional(),
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published']),
    author: z.string().default('community'),
  })
  .refine((data) => data.runtime !== 'cuda' || (!!data.cuda_version && !!data.compute_cap), {
    message: 'cuda_version and compute_cap are required when runtime is cuda',
  })

export type ProblemFrontmatter = z.infer<typeof ProblemFrontmatterSchema>

export type FrontmatterValidationResult =
  | { valid: true; data: ProblemFrontmatter }
  | { valid: false; errors: string[] }

export function validateFrontmatter(
  raw: Record<string, unknown>,
  filePath: string,
): FrontmatterValidationResult {
  const result = ProblemFrontmatterSchema.safeParse(raw)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.') || filePath}: ${issue.message}`,
  )
  return { valid: false, errors }
}
