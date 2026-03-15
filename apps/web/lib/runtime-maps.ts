import type { CppStandard, CudaVersion, ComputeCap } from '@prisma/client'

/** Maps CppStandard enum → compiler flag value, e.g. CPP17 → "17" */
export const CPP_STANDARD: Record<CppStandard, string> = {
  CPP14: '14',
  CPP17: '17',
  CPP20: '20',
  CPP23: '23',
}

/** Maps CudaVersion enum → version string, e.g. CUDA_12_6 → "12.6" */
export const CUDA_VERSION: Record<CudaVersion, string> = {
  CUDA_12_6: '12.6',
}

/** Maps ComputeCap enum → arch flag value, e.g. SM_120 → "sm_120" */
export const COMPUTE_CAP: Record<ComputeCap, string> = {
  SM_86: 'sm_86',
  SM_120: 'sm_120',
}

// ── Reverse maps (string → enum) — used when converting judge result strings back to DB enums ──

const CPP_STANDARD_REV = Object.fromEntries(
  Object.entries(CPP_STANDARD).map(([k, v]) => [v, k]),
) as Record<string, CppStandard>

const CUDA_VERSION_REV = Object.fromEntries(
  Object.entries(CUDA_VERSION).map(([k, v]) => [v, k]),
) as Record<string, CudaVersion>

const COMPUTE_CAP_REV = Object.fromEntries(
  Object.entries(COMPUTE_CAP).map(([k, v]) => [v, k]),
) as Record<string, ComputeCap>

export function toCppStandard(s: string | undefined): CppStandard | undefined {
  return s ? CPP_STANDARD_REV[s] : undefined
}

export function toCudaVersion(s: string | undefined): CudaVersion | undefined {
  return s ? CUDA_VERSION_REV[s] : undefined
}

export function toComputeCap(s: string | undefined): ComputeCap | undefined {
  return s ? COMPUTE_CAP_REV[s] : undefined
}
