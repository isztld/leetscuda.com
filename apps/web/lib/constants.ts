export const DIFFICULTY_COLORS = {
  EASY: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  MEDIUM: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  HARD: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
} as const

export const DIFFICULTY_LABELS: Record<keyof typeof DIFFICULTY_COLORS, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
}

export const SUBMISSION_STATUS_COLORS = {
  ACCEPTED: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    panelBg: 'bg-green-50',
  },
  WRONG_ANSWER: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    panelBg: 'bg-red-50',
  },
  RUNTIME_ERROR: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    panelBg: 'bg-red-50',
  },
  TIME_LIMIT: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    panelBg: 'bg-amber-50',
  },
  PENDING: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    panelBg: 'bg-slate-100',
  },
  RUNNING: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    panelBg: 'bg-blue-50',
  },
  CANCELLED: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    panelBg: 'bg-slate-100',
  },
} as const

export const SUBMISSION_STATUS_LABELS: Record<keyof typeof SUBMISSION_STATUS_COLORS, string> = {
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  RUNTIME_ERROR: 'Runtime Error',
  TIME_LIMIT: 'Time Limit',
  PENDING: 'Pending',
  RUNNING: 'Running',
  CANCELLED: 'Cancelled',
}
