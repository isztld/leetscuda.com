'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export default function SetupUsernamePage() {
  const [username, setUsername] = useState('')
  const [clientError, setClientError] = useState('')
  const router = useRouter()
  const { update } = useSession()

  const mutation = trpc.user.setUsername.useMutation({
    onSuccess: async (data) => {
      await update({ username: data.username })
      router.push('/roadmap')
    },
  })

  const error = clientError || mutation.error?.message

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientError('')

    if (!USERNAME_RE.test(username)) {
      setClientError('3–20 characters: letters, numbers, and underscores only')
      return
    }

    mutation.mutate({ username })
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Choose a username</h1>
          <p className="text-slate-600 mt-2 text-sm">
            This will be your public identity on leetscuda.com
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setClientError('')
                }}
                placeholder="e.g. cuda_wizard"
                maxLength={20}
                autoFocus
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {error && (
                <p className="text-red-600 text-xs mt-2">{error}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors"
            >
              {mutation.isPending ? 'Setting up…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
