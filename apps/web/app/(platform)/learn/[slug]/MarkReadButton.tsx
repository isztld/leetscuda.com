'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'

export function MarkReadButton({ slug, isRead: initialIsRead }: { slug: string; isRead: boolean }) {
  const { status } = useSession()
  const [isRead, setIsRead] = useState(initialIsRead)
  const utils = trpc.useUtils()

  const { mutate, isPending } = trpc.roadmap.markConceptRead.useMutation({
    onSuccess: () => {
      setIsRead(true)
      utils.roadmap.getUserProgress.invalidate()
    },
  })

  if (status !== 'authenticated') return null

  if (isRead) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill="#10b981" fillOpacity="0.15" />
          <path d="M4.5 8.5l2.5 2.5 4.5-5.5" stroke="#10b981" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Completed
      </div>
    )
  }

  return (
    <button
      onClick={() => mutate({ slug })}
      disabled={isPending}
      className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Saving…' : 'Mark as read'}
    </button>
  )
}
