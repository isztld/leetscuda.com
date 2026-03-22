import type { CppStandard } from '@prisma/client'

/** Maps CppStandard enum → compiler flag value, e.g. CPP17 → "17" */
export const CPP_STANDARD: Record<CppStandard, string> = {
  CPP14: '14',
  CPP17: '17',
  CPP20: '20',
  CPP23: '23',
}

// ── Reverse map (string → enum) ──

const CPP_STANDARD_REV = Object.fromEntries(
  Object.entries(CPP_STANDARD).map(([k, v]) => [v, k]),
) as Record<string, CppStandard>

export function toCppStandard(s: string | undefined): CppStandard | undefined {
  return s ? CPP_STANDARD_REV[s] : undefined
}
