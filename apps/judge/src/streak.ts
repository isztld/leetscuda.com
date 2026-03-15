import { getPrisma } from './db.js'

/**
 * Call on every ACCEPTED submission.
 * - Increments streak if last solve was yesterday
 * - Resets to 1 if gap > 1 day
 * - Keeps unchanged if same day
 */
export async function updateStreak(userId: string): Promise<void> {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastActiveAt: true },
  })
  if (!user) return

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let newStreak: number

  if (!user.lastActiveAt) {
    newStreak = 1
  } else {
    const lastStart = new Date(
      user.lastActiveAt.getFullYear(),
      user.lastActiveAt.getMonth(),
      user.lastActiveAt.getDate(),
    )
    const diffDays = Math.round(
      (todayStart.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (diffDays === 0) {
      newStreak = user.streakDays // same day — keep
    } else if (diffDays === 1) {
      newStreak = user.streakDays + 1 // yesterday — increment
    } else {
      newStreak = 1 // gap — reset
    }
  }

  await getPrisma().user.update({
    where: { id: userId },
    data: { streakDays: newStreak, lastActiveAt: now },
  })
}
