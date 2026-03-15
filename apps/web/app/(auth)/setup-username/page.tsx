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
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Choose a username</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            This will be your public identity on leetscuda.com
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
              {error && (
                <p className="text-red-400 text-xs mt-2">{error}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors"
            >
              {mutation.isPending ? 'Setting up…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
