export const DIFFICULTY_COLORS = {
  EASY: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  MEDIUM: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  HARD: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
} as const

export const DIFFICULTY_LABELS: Record<keyof typeof DIFFICULTY_COLORS, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
}

export const SUBMISSION_STATUS_COLORS = {
  ACCEPTED: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    panelBg: 'bg-emerald-950',
  },
  WRONG_ANSWER: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    panelBg: 'bg-red-950',
  },
  RUNTIME_ERROR: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    panelBg: 'bg-red-950',
  },
  TIME_LIMIT: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    panelBg: 'bg-orange-950',
  },
  PENDING: {
    bg: 'bg-zinc-500/15',
    text: 'text-zinc-400',
    panelBg: 'bg-zinc-800',
  },
  RUNNING: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    panelBg: 'bg-blue-950',
  },
} as const

export const SUBMISSION_STATUS_LABELS: Record<keyof typeof SUBMISSION_STATUS_COLORS, string> = {
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  RUNTIME_ERROR: 'Runtime Error',
  TIME_LIMIT: 'Time Limit',
  PENDING: 'Pending',
  RUNNING: 'Running',
}
